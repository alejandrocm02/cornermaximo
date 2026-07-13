/**
 * Runner de sincronización: en cada ejecución (lanzada por GitHub Actions)
 * decide qué trabajo hacer, por prioridad, hasta agotar el presupuesto asignado.
 *
 * Prioridades:
 *  1. Bootstrap: competiciones (0 req) -> equipos -> calendario -> plantillas
 *  2. Resultados: refrescar fixtures si hay partidos pendientes de resultado (1 req/liga)
 *  3. Stats post-partido, primera pasada (2 req/partido, los más recientes primero)
 *  4. Segunda pasada de verificación a las 24h (2 req/partido)
 *  5. Clasificación (1 req/liga, máx. 1 vez/20h)
 *  6. Lesiones (1 req/liga, máx. 1 vez/20h)
 */
import type { PrismaClient, SyncEntity } from '@futstats/db';
import {
  ApiFootballClient,
  ApiFootballProvider,
  BudgetExceededError,
  type FootballDataProvider,
} from '@futstats/providers';
import { PrismaBudgetGuard } from './budget';
import {
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
/** Margen frente al límite de 60s de Vercel Hobby: paramos limpiamente antes. */
const TIME_BUDGET_MS = 45_000;

class TimeBudgetExceededError extends Error {
  constructor() {
    super('Presupuesto de tiempo de la ejecución agotado; se continúa en la próxima tanda.');
    this.name = 'TimeBudgetExceededError';
  }
}

export interface SyncRunOptions {
  maxRequests?: number;
  season?: number;
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
  const season = options.season ?? Number(process.env.CURRENT_SEASON ?? new Date().getFullYear());
  const dailyLimit = Number(process.env.API_FOOTBALL_DAILY_LIMIT ?? 100);
  const maxRequests = options.maxRequests ?? 25;

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
    // 1. Competiciones y temporadas (0 requests con API-Football)
    await unit('COMPETITIONS', null, 'competiciones', 1, () =>
      syncCompetitions(db, provider, providerRow.id, season),
    );

    const competitions = await db.competition.findMany({
      include: { seasons: { where: { year: season }, include: { _count: { select: { teams: true, matches: true } } } } },
    });

    // 2. Equipos de ligas sin equipos
    for (const comp of competitions) {
      const s = comp.seasons[0];
      if (s != null && s._count.teams === 0) {
        await unit('TEAMS', comp.externalId, `equipos:${comp.slug}`, 1, () =>
          syncTeams(db, provider, providerRow.id, comp.externalId, season),
        );
      }
    }

    // 3. Calendario: ligas sin partidos, o con resultados pendientes y sync antiguo
    for (const comp of competitions) {
      const s = comp.seasons[0];
      if (s == null) continue;
      const needsBootstrap = s._count.matches === 0;
      const pendingResults = await db.match.count({
        where: { seasonId: s.id, status: 'SCHEDULED', kickoffAt: { lt: new Date() } },
      });
      const stale = hoursAgo(await lastSuccessAt(db, 'FIXTURES', comp.externalId)) > 6;
      if (needsBootstrap || (pendingResults > 0 && stale)) {
        await unit('FIXTURES', comp.externalId, `calendario:${comp.slug}`, 2, () =>
          syncFixtures(db, provider, providerRow.id, comp.externalId, season),
        );
      }
    }

    // 4. Plantillas de equipos sin jugadores (bootstrap progresivo, 1 req/equipo)
    const teamsWithoutPlayers = await db.team.findMany({
      where: { players: { none: {} }, seasons: { some: { season: { year: season } } } },
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
      take: 40,
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
      take: 20,
    });
    for (const match of toVerify) {
      await unit('MATCH_DETAILS', match.externalId, `verificacion:${match.externalId}`, 4, async () => {
        await syncMatchStats(db, provider, providerRow.id, match.id, match.externalId);
        await db.match.update({ where: { id: match.id }, data: { statsVerifiedAt: new Date() } });
      });
    }

    // 7. Clasificación (máx. 1 vez cada STALE_HOURS por liga)
    for (const comp of competitions) {
      if (hoursAgo(await lastSuccessAt(db, 'STANDINGS', comp.externalId)) > STALE_HOURS) {
        await unit('STANDINGS', comp.externalId, `clasificacion:${comp.slug}`, 5, () =>
          syncStandings(db, provider, providerRow.id, comp.externalId, season),
        );
      }
    }

    // 8. Lesiones (máx. 1 vez cada STALE_HOURS por liga)
    for (const comp of competitions) {
      if (hoursAgo(await lastSuccessAt(db, 'INJURIES', comp.externalId)) > STALE_HOURS) {
        await unit('INJURIES', comp.externalId, `lesiones:${comp.slug}`, 6, () =>
          syncInjuries(db, provider, providerRow.id, comp.externalId, season),
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
