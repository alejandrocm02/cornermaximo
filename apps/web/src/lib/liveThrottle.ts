import 'server-only';

import { prisma } from '@cornermaximo/db';
import { unstable_cache } from 'next/cache';
import { isLiveEligible, isWithinInterval } from '@/lib/liveGuard';
import {
  syncLiveMatchCore,
  syncLiveMatchDetail,
  syncLiveScoreboard,
  type LiveCoreSnapshot,
  type LiveScoreboardResult,
} from '@/lib/liveMatchSync';

/**
 * Throttle compartido de los endpoints públicos de directo.
 *
 * La caché del CDN se evita añadiendo cualquier query string, y las respuestas
 * de error no se cacheaban, así que cada petición podía acabar en el proveedor.
 * Aquí el resultado (también el fallo) se guarda en la caché de datos de Next,
 * común a todas las instancias: como mucho una consulta al proveedor por
 * intervalo, llegue el tráfico que llegue.
 *
 * Esa caché es "stale-while-revalidate": pasado el intervalo devuelve el
 * resultado anterior y recalcula en segundo plano. `settle` espera a ese
 * recálculo para que la petición que lo provoca reciba ya el dato nuevo; sin
 * ello cada respuesta iba un sondeo por detrás.
 */
export type Throttled<T> = { ok: true; value: T; at: string } | { ok: false; at: string };

const SCOREBOARD_INTERVAL_S = 20;
const CORE_INTERVAL_S = 60;
const DETAIL_INTERVAL_S = 180;
const SETTLE_ATTEMPTS = 5;
const SETTLE_WAIT_MS = 900;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function settle<T>(read: () => Promise<Throttled<T>>, intervalSeconds: number): Promise<Throttled<T>> {
  let result = await read();
  for (let i = 0; i < SETTLE_ATTEMPTS && !isWithinInterval(result.at, intervalSeconds * 1000); i++) {
    await sleep(SETTLE_WAIT_MS);
    result = await read();
  }
  return result;
}

const TERMINAL = ['FINISHED', 'POSTPONED', 'SUSPENDED', 'ABANDONED', 'CANCELLED'];

async function attempt<T>(label: string, run: () => Promise<T>): Promise<Throttled<T>> {
  try {
    const value = await run();
    return { ok: true, value, at: new Date().toISOString() };
  } catch (error) {
    console.error(`${label} failed`, error);
    return { ok: false, at: new Date().toISOString() };
  }
}

const cachedScoreboard = unstable_cache(
  () => attempt('live scoreboard sync', syncLiveScoreboard),
  ['live-scoreboard-v2'],
  { revalidate: SCOREBOARD_INTERVAL_S },
);

export function throttledScoreboard(): Promise<Throttled<LiveScoreboardResult>> {
  return settle(cachedScoreboard, SCOREBOARD_INTERVAL_S);
}

const cachedCore = unstable_cache(
  (matchId: number) => attempt('live match core sync', () => syncLiveMatchCore(matchId)),
  ['live-match-core-v2'],
  { revalidate: CORE_INTERVAL_S },
);

const throttledCore = (matchId: number) => settle(() => cachedCore(matchId), CORE_INTERVAL_S);

const cachedDetail = unstable_cache(
  (matchId: number) =>
    attempt('live match detail sync', async () => {
      const result = await syncLiveMatchDetail(matchId);
      return result == null ? null : { ...result, refreshedAt: new Date().toISOString() };
    }),
  ['live-match-detail-v2'],
  { revalidate: DETAIL_INTERVAL_S },
);

const throttledDetail = (matchId: number) => settle(() => cachedDetail(matchId), DETAIL_INTERVAL_S);

async function storedMatch(matchId: number) {
  return prisma.match.findUnique({
    where: { id: matchId },
    select: {
      status: true,
      kickoffAt: true,
      teams: { select: { isHome: true, goals: true } },
      _count: { select: { events: true } },
    },
  });
}

export type GuardedCore =
  | { kind: 'not_found' }
  | { kind: 'stored'; snapshot: LiveCoreSnapshot }
  | { kind: 'synced'; result: Throttled<LiveCoreSnapshot | null> };

/** Núcleo del partido: solo consulta al proveedor si el encuentro está en su ventana de directo. */
export async function guardedMatchCore(matchId: number): Promise<GuardedCore> {
  const match = await storedMatch(matchId);
  if (match == null) return { kind: 'not_found' };

  const status = String(match.status);
  if (isLiveEligible(status, match.kickoffAt)) {
    return { kind: 'synced', result: await throttledCore(matchId) };
  }

  return {
    kind: 'stored',
    snapshot: {
      status,
      elapsed: null,
      extra: null,
      homeGoals: match.teams.find((team) => team.isHome)?.goals ?? null,
      awayGoals: match.teams.find((team) => !team.isHome)?.goals ?? null,
      eventCount: match._count.events,
      terminal: TERMINAL.includes(status),
      refreshedAt: new Date().toISOString(),
    },
  };
}

export type GuardedDetail =
  | { kind: 'not_found' }
  | { kind: 'stored'; terminal: boolean }
  | { kind: 'synced'; result: Throttled<{ processed: number; terminal: boolean; refreshedAt: string } | null> };

export async function guardedMatchDetail(matchId: number): Promise<GuardedDetail> {
  const match = await storedMatch(matchId);
  if (match == null) return { kind: 'not_found' };

  const status = String(match.status);
  if (isLiveEligible(status, match.kickoffAt)) {
    return { kind: 'synced', result: await throttledDetail(matchId) };
  }
  return { kind: 'stored', terminal: TERMINAL.includes(status) };
}
