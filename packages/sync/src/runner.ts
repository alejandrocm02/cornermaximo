/**
 * Runner de sincronización: en cada ejecución (lanzada por GitHub Actions)
 * decide qué trabajo hacer, por prioridad, hasta agotar el presupuesto asignado.
 *
 * Sincroniza TODAS las competiciones rastreadas (`TRACKED_COMPETITIONS`: las 5 grandes
 * ligas en sus temporadas 2025-26 y 2026-27, y el Mundial 2026) y, dentro de cada una,
 * TODAS sus temporadas configuradas — no una única "temporada actual" global.
 *
 * Prioridades:
 *  1. Bootstrap: competiciones y temporadas (0 req) -> equipos -> calendario -> plantillas
 *  2. Resultados: refrescar fixtures si hay partidos pendientes de resultado (1 req/competición-temporada)
 *  3. Stats post-partido, primera pasada (2 req/partido, los más recientes primero)
 *  4. Segunda pasada de verificación a las 24h (2 req/partido)
 *  5. Clasificación (1 req/competición-temporada, máx. 1 vez/20h)
 *  6. Lesiones (1 req/competición-temporada, máx. 1 vez/20h)
 */
import type { PrismaClient, SyncEntity } from '@futstats/db';
import {
  ApiFootballClient,
  ApiFootballProvider,
  BudgetExceededError,
  type FootballDataProvider,
} from '@futstats/providers';
import { TRACKED_COMPETITIONS } from '@futstats/shared';
import { PrismaBudgetGuard } from './budget';
import { syncNews } from './news';
import {
  cleanupTransferDuplicates,
  syncTransfers,
  syncCompetitions,
  syncFixtures,
  syncInjuries,
  syncMatchStats,
  syncSquad,
  syncStandings,
  syncTeams,
} from './services';

const STALE_HOURS = 20;
const VERIFY_AFTER_HOURS = 24;
/** Margen frente al límite de 60s de Vercel Hobby: paramos limpiamente antes (no depende del plan de API-Football). */
const TIME_BUDGET_MS = 45_000;

class TimeBudgetExceededError extends Error {
  constructor() {
    super('Presupuesto de tiempo de la ejecución agotado; se continúa en la próxima tanda.');
    this.name = 'TimeBudgetExceededError';
  }
}

export interface SyncRunOptions {
  /** Nº máximo de requests a gastar en esta ejecución (plan Pro: hasta 7 500/día). */
  maxRequests?: number;
}

export interface SyncRunResult {
  executed: string[];
  requestsUsedThisRun: number;
  stopped: 'completed' | 'budget_exhausted' | 'time_budget_exhausted';
}

export function createApiFootballProvider(budget: PrismaBudgetGuard): FootballDataProvider {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (apiKey == null || apiKey === '') throw new Error('Falta API_FOOTBALL_KEY');
  return new ApiFootballProvider(
    new ApiFootballClient({
      apiKey,
      baseUrl: process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io',
      budget,
      minIntervalMs: process.env.API_FOOTBALL_MIN_INTERVAL_MS != null
        ? Number(process.env.API_FOOTBALL_MIN_INTERVAL_MS)
        : undefined,
    }),
  );
}

async function lastSuccessAt(
  db: PrismaClient,
  entity: SyncEntity,
  entityExternalId: string | null,
): Promise<Date | null> {
  const job = await db.syncJob.findFirst({
    where: { entity, entityExternalId, status: 'SUCCESS' },
    orderBy: { finishedAt: 'desc' },
  });
  return job?.finishedAt ?? null;
}

function hoursAgo(date: Date | null): number {
  if (date == null) return Infinity;
  return (Date.now() - date.getTime()) / 3_600_000;
}

export async function runSync(db: PrismaClient, options: SyncRunOptions = {}): Promise<SyncRunResult> {
  const dailyLimit = Number(process.env.API_FOOTBALL_DAILY_LIMIT ?? 7_500);
  const maxRequests = options.maxRequests ?? 200;

  const providerRow = await db.dataProvider.upsert({
    where: { name: 'api-football' },
    update: {},
    create: { name: 'api-football', priority: 1 },
  });

  const budget = new PrismaBudgetGuard(db, providerRow.id, dailyLimit, maxRequests);
  const provider = createApiFootballProvider(budget);
  const executed: string[] = [];
  const startedAtMs = Date.now();

  /** Ejecuta una unidad de trabajo con registro en SyncJob/SyncLog. */
  async function unit(
    entity: SyncEntity,
    entityExternalId: string | null,
    label: string,
    priority: number,
    fn: () => Promise<unknown>,
  ): Promise<void> {
    if (Date.now() - startedAtMs > TIME_BUDGET_MS) {
      throw new TimeBudgetExceededError();
    }
    const job = await db.syncJob.create({
      data: { providerId: providerRow.id, entity, entityExternalId, status: 'RUNNING', priority, startedAt: new Date() },
    });
    try {
      await fn();
      await db.syncJob.update({
        where: { id: job.id },
        data: { status: 'SUCCESS', finishedAt: new Date() },
      });
      executed.push(label);
    } catch (err) {
      const isBudget = err instanceof BudgetExceededError;
      await db.syncJob.update({
        where: { id: job.id },
        data: {
          status: isBudget ? 'PENDING' : 'FAILED', // budget agotado => se reintenta en la próxima tanda
          finishedAt: new Date(),
          error: String(err instanceof Error ? err.message : err).slice(0, 1000),
          attempts: { increment: 1 },
        },
      });
      if (!isBudget) {
        await db.syncLog.create({
          data: { syncJobId: job.id, level: 'error', message: `${label}: ${String(err)}`.slice(0, 900) },
        });
      }
      throw err;
    }
  }

  try {
    // 1. Competiciones y TODAS sus temporadas rastreadas (0 requests con API-Football)
    await unit('COMPETITIONS', null, 'competiciones', 1, () =>
      syncCompetitions(db, provider, providerRow.id),
    );

    const competitions = await db.competition.findMany({
      include: { seasons: { include: { _count: { select: { teams: true, matches: true } } } } },
    });

    // Pares (competición, temporada) a procesar: cada competición puede tener varias
    // temporadas activas a la vez (p.ej. LaLiga 2025-26 y 2026-27).
    type CompSeason = { comp: (typeof competitions)[number]; season: (typeof competitions)[number]['seasons'][number] };
    // Solo se mantienen activamente las temporadas rastreadas; las históricas
    // (p.ej. 2024-25) quedan en la base de datos pero no gastan requests.
    const compSeasons: CompSeason[] = competitions.flatMap((comp) => {
      const tracked = TRACKED_COMPETITIONS.find((t) => String(t.apiFootballId) === comp.externalId);
      return comp.seasons
        .filter((season) => tracked?.seasons.includes(season.year) ?? false)
        .map((season) => ({ comp, season }));
    });
    /** Clave estable para trackear frescura por (competición, temporada) en SyncJob. */
    const key = (comp: { externalId: string }, season: { year: number }) => `${comp.externalId}:${season.year}`;

    // 2. Equipos de competición-temporada sin equipos
    for (const { comp, season } of compSeasons) {
      if (season._count.teams === 0) {
        await unit('TEAMS', key(comp, season), `equipos:${comp.slug}:${season.year}`, 1, () =>
          syncTeams(db, provider, providerRow.id, comp.externalId, season.year),
        );
      }
    }

    // 3. Calendario: competición-temporada sin partidos, o con resultados pendientes y sync antiguo
    for (const { comp, season } of compSeasons) {
      const needsBootstrap = season._count.matches === 0;
      const pendingResults = await db.match.count({
        where: { seasonId: season.id, status: 'SCHEDULED', kickoffAt: { lt: new Date() } },
      });
      // El Mundial 2026 está en juego: refrescamos su calendario más a menudo (2h) que las ligas (6h).
      const staleHours = comp.slug === 'mundial-2026' ? 2 : 6;
      const stale = hoursAgo(await lastSuccessAt(db, 'FIXTURES', key(comp, season))) > staleHours;
      if (needsBootstrap || (pendingResults > 0 && stale)) {
        await unit('FIXTURES', key(comp, season), `calendario:${comp.slug}:${season.year}`, 2, () =>
          syncFixtures(db, provider, providerRow.id, comp.externalId, season.year),
        );
      }
    }

    // 3.5 Clasificación inicial: competición-temporada sin ninguna fila aún.
    // Va ANTES del backfill masivo de estadísticas para no quedar relegada horas.
    for (const { comp, season } of compSeasons) {
      const hasStandings = await db.standing.count({ where: { seasonId: season.id } });
      if (hasStandings === 0) {
        await unit('STANDINGS', key(comp, season), `clasificacion:${comp.slug}:${season.year}`, 2, () =>
          syncStandings(db, provider, providerRow.id, comp.externalId, season.year),
        );
      }
    }

    // 4. Plantillas de equipos sin jugadores (bootstrap progresivo, 1 req/equipo)
    const teamsWithoutPlayers = await db.team.findMany({
      where: { players: { none: {} }, seasons: { some: {} } },
      orderBy: { id: 'asc' },
    });
    for (const team of teamsWithoutPlayers) {
      await unit('SQUADS', team.externalId, `plantilla:${team.slug}`, 2, () =>
        syncSquad(db, provider, providerRow.id, team.id, team.externalId),
      );
    }

    // 5. Primera pasada de stats: partidos FINISHED sin jugadores registrados
    const unsyncedMatches = await db.match.findMany({
      where: { status: 'FINISHED', matchPlayers: { none: {} } },
      orderBy: { kickoffAt: 'desc' }, // los más recientes primero: alimentan "últimos 5"
      take: 80,
    });
    for (const match of unsyncedMatches) {
      await unit('PLAYER_MATCH_STATS', match.externalId, `stats:${match.externalId}`, 3, () =>
        syncMatchStats(db, provider, providerRow.id, match.id, match.externalId),
      );
    }

    // 6. Segunda pasada (correcciones del proveedor) 24h después
    const toVerify = await db.match.findMany({
      where: {
        status: 'FINISHED',
        statsVerifiedAt: null,
        matchPlayers: { some: {} },
        kickoffAt: { lt: new Date(Date.now() - VERIFY_AFTER_HOURS * 3_600_000) },
      },
      orderBy: { kickoffAt: 'asc' },
      take: 40,
    });
    for (const match of toVerify) {
      await unit('MATCH_DETAILS', match.externalId, `verificacion:${match.externalId}`, 4, async () => {
        await syncMatchStats(db, provider, providerRow.id, match.id, match.externalId);
        await db.match.update({ where: { id: match.id }, data: { statsVerifiedAt: new Date() } });
      });
    }

    // 7. Clasificación (Mundial en juego: cada 2h; ligas: cada STALE_HOURS)
    for (const { comp, season } of compSeasons) {
      const standingsStaleHours = comp.slug === 'mundial-2026' ? 2 : STALE_HOURS;
      if (hoursAgo(await lastSuccessAt(db, 'STANDINGS', key(comp, season))) > standingsStaleHours) {
        await unit('STANDINGS', key(comp, season), `clasificacion:${comp.slug}:${season.year}`, 5, () =>
          syncStandings(db, provider, providerRow.id, comp.externalId, season.year),
        );
      }
    }

    // 7.5 Noticias (RSS, sin coste de API): máx. 1 vez cada 50 minutos
    if (hoursAgo(await lastSuccessAt(db, 'NEWS', null)) > 0.83) {
      await unit('NEWS', null, 'noticias', 5, () => syncNews(db));
    }

    // 7.6 Traspasos por club (1 req/club, máx. 1 vez cada 24h)
    const clubTeams = await db.team.findMany({
      where: { isNational: false, seasons: { some: {} } },
      select: { id: true, externalId: true, slug: true },
      orderBy: { id: 'asc' },
    });
    for (const club of clubTeams) {
      if (hoursAgo(await lastSuccessAt(db, 'TRANSFERS', club.externalId)) > 24) {
        await unit('TRANSFERS', club.externalId, `traspasos:${club.slug}`, 5, () =>
          syncTransfers(db, provider, providerRow.id, club.id, club.externalId),
        );
      }
    }

    // 7.7 Limpieza de operaciones duplicadas del proveedor (sin coste de API)
    await cleanupTransferDuplicates(db);

    // 8. Lesiones (máx. 1 vez cada STALE_HOURS por competición-temporada)
    for (const { comp, season } of compSeasons) {
      if (hoursAgo(await lastSuccessAt(db, 'INJURIES', key(comp, season))) > STALE_HOURS) {
        await unit('INJURIES', key(comp, season), `lesiones:${comp.slug}:${season.year}`, 6, () =>
          syncInjuries(db, provider, providerRow.id, comp.externalId, season.year),
        );
      }
    }
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      return { executed, requestsUsedThisRun: budget.usedThisRun, stopped: 'budget_exhausted' };
    }
    if (err instanceof TimeBudgetExceededError) {
      return { executed, requestsUsedThisRun: budget.usedThisRun, stopped: 'time_budget_exhausted' };
    }
    throw err;
  }

  return { executed, requestsUsedThisRun: budget.usedThisRun, stopped: 'completed' };
}
