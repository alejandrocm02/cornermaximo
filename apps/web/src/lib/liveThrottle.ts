import 'server-only';

import { prisma } from '@cornermaximo/db';
import { unstable_cache } from 'next/cache';
import { isLiveEligible } from '@/lib/liveGuard';
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
 */
export type Throttled<T> = { ok: true; value: T } | { ok: false };

const TERMINAL = ['FINISHED', 'POSTPONED', 'SUSPENDED', 'ABANDONED', 'CANCELLED'];

async function attempt<T>(label: string, run: () => Promise<T>): Promise<Throttled<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    console.error(`${label} failed`, error);
    return { ok: false };
  }
}

export const throttledScoreboard: () => Promise<Throttled<LiveScoreboardResult>> = unstable_cache(
  () => attempt('live scoreboard sync', syncLiveScoreboard),
  ['live-scoreboard-v1'],
  { revalidate: 20 },
);

const throttledCore = unstable_cache(
  (matchId: number) => attempt('live match core sync', () => syncLiveMatchCore(matchId)),
  ['live-match-core-v1'],
  { revalidate: 60 },
);

const throttledDetail = unstable_cache(
  (matchId: number) =>
    attempt('live match detail sync', async () => {
      const result = await syncLiveMatchDetail(matchId);
      return result == null ? null : { ...result, refreshedAt: new Date().toISOString() };
    }),
  ['live-match-detail-v1'],
  { revalidate: 180 },
);

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
