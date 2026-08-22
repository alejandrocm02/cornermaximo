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
import type { PrismaClient, SyncEntity } from '@cornermaximo/db';
import {
  ApiFootballClient,
  ApiFootballProvider,
  BudgetExceededError,
  type FootballDataProvider,
} from '@cornermaximo/providers';
import { TRACKED_COMPETITIONS } from '@cornermaximo/shared';
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
const API_FOOTBALL_CONTRACT_DAILY_LIMIT = 5_000;
const API_FOOTBALL_MAX_USAGE_RATIO = 0.75;
const API_FOOTBALL_SAFE_DAILY_LIMIT = Math.floor(
  API_FOOTBALL_CONTRACT_DAILY_LIMIT * API_FOOTBALL_MAX_USAGE_RATIO,
);
/** Margen frente al límite de 60s de Vercel Hobby: paramos limpiamente antes (no depende del plan de API-Football). */
// Leave enough headroom for the current unit, response serialization and the
// platform boundary. Starting new work at 45s caused occasional 60s function
// timeouts when a provider request was slower than usual.
const TIME_BUDGET_MS = 35_000;

class TimeBudgetExceededError extends Error {
  constructor() {
    super('Presupuesto de tiempo de la ejecución agotado; se continúa en la próxima tanda.');
    this.name = 'TimeBudgetExceededError';
  }
}

export interface SyncRunOptions {
  /** Nº máximo de requests a gastar en esta ejecución. */
  maxRequests?: number;
}

export interface SyncRunResult {
  executed: string[];
  /** Unidades que fallaron en esta tanda sin detener el resto de la cola. */
  failed: string[];
  /** Unidades aparcadas por fallar de forma repetida; se reintentan a las 24h. */
  skipped: string[];
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
  const configured = Number(process.env.API_FOOTBALL_DAILY_LIMIT ?? API_FOOTBALL_SAFE_DAILY_LIMIT);
  const dailyLimit = Number.isFinite(configured)
    ? Math.min(Math.max(1, configured), API_FOOTBALL_SAFE_DAILY_LIMIT)
    : API_FOOTBALL_SAFE_DAILY_LIMIT;
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
  const failed: string[] = [];
  const skipped: string[] = [];

  const ensureTime = () => {
    if (Date.now() - startedAtMs >= TIME_BUDGET_MS) throw new TimeBudgetExceededError();
  };

  const runUnit = async (label: string, task: () => Promise<void>) => {
    ensureTime();
    try {
      await task();
      executed.push(label);
    } catch (error) {
      if (error instanceof BudgetExceededError || error instanceof TimeBudgetExceededError) throw error;
      failed.push(label);
    }
  };

  try {
    await runUnit('competitions', async () => {
      await syncCompetitions(db, provider, providerRow.id);
    });

    for (const tracked of TRACKED_COMPETITIONS) {
      ensureTime();
      const competition = await db.competition.findFirst({
        where: { providerId: providerRow.id, externalId: String(tracked.apiFootballId) },
        include: { seasons: true },
      });
      if (competition == null) continue;

      for (const seasonConfig of tracked.seasons) {
        ensureTime();
        const season = competition.seasons.find((entry) => entry.year === seasonConfig.year);
        if (season == null) continue;
        const key = `${competition.externalId}:${season.year}`;

        await runUnit(`teams:${key}`, async () => {
          const last = await lastSuccessAt(db, 'TEAMS', key);
          if (hoursAgo(last) < STALE_HOURS) return;
          await syncTeams(db, provider, providerRow.id, competition.id, competition.externalId, season.year);
        });

        await runUnit(`fixtures:${key}`, async () => {
          const pending = await db.match.count({
            where: { seasonId: season.id, status: { in: ['SCHEDULED', 'LIVE'] } },
          });
          const last = await lastSuccessAt(db, 'FIXTURES', key);
          if (pending === 0 && hoursAgo(last) < STALE_HOURS) return;
          await syncFixtures(db, provider, providerRow.id, season.id, competition.externalId, season.year);
        });

        const seasonTeams = await db.seasonTeam.findMany({
          where: { seasonId: season.id },
          include: { team: true },
        });
        for (const seasonTeam of seasonTeams) {
          ensureTime();
          await runUnit(`squad:${seasonTeam.team.externalId}`, async () => {
            const last = await lastSuccessAt(db, 'SQUADS', seasonTeam.team.externalId);
            if (hoursAgo(last) < STALE_HOURS) return;
            await syncSquad(db, provider, providerRow.id, seasonTeam.team.id, seasonTeam.team.externalId);
          });
        }

        const recentFinished = await db.match.findMany({
          where: {
            seasonId: season.id,
            status: 'FINISHED',
            matchPlayers: { none: {} },
          },
          orderBy: { kickoffAt: 'desc' },
          take: 10,
        });
        for (const match of recentFinished) {
          ensureTime();
          await runUnit(`stats:${match.externalId}`, async () => {
            await syncMatchStats(db, provider, providerRow.id, match.id, match.externalId);
          });
        }

        const verifyBefore = new Date(Date.now() - VERIFY_AFTER_HOURS * 3_600_000);
        const unverified = await db.match.findMany({
          where: {
            seasonId: season.id,
            status: 'FINISHED',
            kickoffAt: { lte: verifyBefore },
            statsVerifiedAt: null,
            matchPlayers: { some: {} },
          },
          orderBy: { kickoffAt: 'desc' },
          take: 5,
        });
        for (const match of unverified) {
          ensureTime();
          await runUnit(`verify:${match.externalId}`, async () => {
            await syncMatchStats(db, provider, providerRow.id, match.id, match.externalId);
            await db.match.update({ where: { id: match.id }, data: { statsVerifiedAt: new Date() } });
          });
        }

        await runUnit(`standings:${key}`, async () => {
          const last = await lastSuccessAt(db, 'STANDINGS', key);
          if (hoursAgo(last) < STALE_HOURS) return;
          await syncStandings(db, provider, providerRow.id, season.id, competition.externalId, season.year);
        });

        await runUnit(`injuries:${key}`, async () => {
          const last = await lastSuccessAt(db, 'INJURIES', key);
          if (hoursAgo(last) < STALE_HOURS) return;
          await syncInjuries(db, provider, providerRow.id, competition.id, season.year);
        });
      }
    }

    await runUnit('transfers', async () => {
      await syncTransfers(db, provider, providerRow.id);
      await cleanupTransferDuplicates(db);
    });

    await runUnit('news', async () => {
      await syncNews(db);
    });

    return {
      executed,
      failed,
      skipped,
      requestsUsedThisRun: budget.usedThisRun,
      stopped: 'completed',
    };
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      return {
        executed,
        failed,
        skipped,
        requestsUsedThisRun: budget.usedThisRun,
        stopped: 'budget_exhausted',
      };
    }
    if (error instanceof TimeBudgetExceededError) {
      return {
        executed,
        failed,
        skipped,
        requestsUsedThisRun: budget.usedThisRun,
        stopped: 'time_budget_exhausted',
      };
    }
    throw error;
  }
}
