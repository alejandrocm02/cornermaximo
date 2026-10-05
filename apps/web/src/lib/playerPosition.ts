/**
 * Demarcación efectiva de un jugador.
 *
 * La posición registrada viene de la plantilla del proveedor y a menudo no
 * coincide con dónde juega (extremos fichados como centrocampistas). Como los
 * percentiles y los jugadores similares se calculan por demarcación, comparar
 * con la registrada daba cohortes equivocadas. Si en sus últimos partidos ha
 * jugado de forma consistente en otra línea, manda la que juega.
 */
import { prisma } from '@cornermaximo/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG, FOOTBALL_DATA_REVALIDATE_SECONDS } from './cache';

export type PositionGroupCode = 'GK' | 'DF' | 'MF' | 'FW';

const PLAYED_TO_GROUP: Record<string, PositionGroupCode> = { G: 'GK', D: 'DF', M: 'MF', F: 'FW' };
const RECENT_MATCHES = 10;
const MIN_MATCHES = 3;
const MIN_SHARE = 0.6;

export function dominantPlayedGroup(
  played: Array<string | null>,
  registered: PositionGroupCode | null,
): PositionGroupCode | null {
  const groups = played
    .map((value) => (value != null ? PLAYED_TO_GROUP[value] : undefined))
    .filter((value): value is PositionGroupCode => value != null);
  if (groups.length < MIN_MATCHES) return registered;

  const counts = new Map<PositionGroupCode, number>();
  for (const group of groups) counts.set(group, (counts.get(group) ?? 0) + 1);
  const [top, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return count / groups.length >= MIN_SHARE ? top : registered;
}

async function queryEffectivePositionGroup(
  playerId: number,
  registered: PositionGroupCode | null,
): Promise<PositionGroupCode | null> {
  const recent = await prisma.matchPlayer.findMany({
    where: { playerId, minutesPlayed: { gt: 0 }, match: { status: 'FINISHED' } },
    orderBy: { match: { kickoffAt: 'desc' } },
    take: RECENT_MATCHES,
    select: { positionPlayed: true },
  });
  return dominantPlayedGroup(recent.map((row) => row.positionPlayed), registered);
}

const cachedEffectivePositionGroup = unstable_cache(queryEffectivePositionGroup, ['player-effective-position-v1'], {
  revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG],
});

export function getEffectivePositionGroup(
  playerId: number,
  registered: PositionGroupCode | null,
): Promise<PositionGroupCode | null> {
  return cachedEffectivePositionGroup(playerId, registered);
}
