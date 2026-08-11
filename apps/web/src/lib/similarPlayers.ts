import { PositionGroup, prisma } from '@cornermaximo/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG, FOOTBALL_DATA_REVALIDATE_SECONDS } from '@/lib/cache';

type MetricKey =
  | 'goals'
  | 'assists'
  | 'shotsOnTarget'
  | 'keyPasses'
  | 'progressivePasses'
  | 'dribblesCompleted'
  | 'tacklesWon'
  | 'interceptions'
  | 'recoveries'
  | 'clearances'
  | 'duelsWon'
  | 'saves'
  | 'goalsConceded'
  | 'longBallsCompleted'
  | 'highClaims';

type RunningMetric = { sum: number; minutes: number; seen: boolean };
type Aggregate = {
  playerId: number;
  minutes: number;
  metrics: Record<MetricKey, RunningMetric>;
};

export type SimilarPlayer = {
  id: number;
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  teamCrestUrl: string | null;
  similarity: number;
  minutes: number;
};

export type SimilarPlayersResult = {
  competition: string | null;
  seasonYear: number | null;
  positionGroup: PositionGroup;
  minimumMinutes: number;
  players: SimilarPlayer[];
};

const KEYS: MetricKey[] = [
  'goals', 'assists', 'shotsOnTarget', 'keyPasses', 'progressivePasses', 'dribblesCompleted',
  'tacklesWon', 'interceptions', 'recoveries', 'clearances', 'duelsWon', 'saves',
  'goalsConceded', 'longBallsCompleted', 'highClaims',
];

const POSITION_METRICS: Record<PositionGroup, MetricKey[]> = {
  FW: ['goals', 'assists', 'shotsOnTarget', 'keyPasses', 'dribblesCompleted', 'duelsWon'],
  MF: ['assists', 'keyPasses', 'progressivePasses', 'recoveries', 'tacklesWon', 'duelsWon'],
  DF: ['tacklesWon', 'interceptions', 'recoveries', 'clearances', 'duelsWon', 'progressivePasses'],
  GK: ['saves', 'goalsConceded', 'longBallsCompleted', 'highClaims'],
};

function emptyAggregate(playerId: number): Aggregate {
  return {
    playerId,
    minutes: 0,
    metrics: Object.fromEntries(KEYS.map((key) => [key, { sum: 0, minutes: 0, seen: false }])) as Record<MetricKey, RunningMetric>,
  };
}

function addMetric(aggregate: Aggregate, key: MetricKey, value: number | null | undefined, minutes: number) {
  if (value == null) return;
  const metric = aggregate.metrics[key];
  metric.sum += value;
  metric.minutes += minutes;
  metric.seen = true;
}

function per90(aggregate: Aggregate, key: MetricKey): number | null {
  const metric = aggregate.metrics[key];
  if (!metric.seen || metric.minutes <= 0) return null;
  return metric.sum * 90 / metric.minutes;
}

function percentile(value: number, values: number[], lowerIsBetter = false): number {
  const rank = lowerIsBetter
    ? values.filter((candidate) => candidate >= value).length
    : values.filter((candidate) => candidate <= value).length;
  return Math.max(0, Math.min(1, rank / values.length));
}

async function querySimilarPlayers(
  playerId: number,
  positionGroup: PositionGroup,
): Promise<SimilarPlayersResult> {
  const latest = await prisma.matchPlayer.findFirst({
    where: { playerId, minutesPlayed: { gt: 0 }, match: { status: 'FINISHED' } },
    orderBy: { match: { kickoffAt: 'desc' } },
    select: {
      match: {
        select: {
          seasonId: true,
          season: { select: { year: true, competition: { select: { name: true } } } },
        },
      },
    },
  });

  if (latest == null) {
    return { competition: null, seasonYear: null, positionGroup, minimumMinutes: 450, players: [] };
  }

  const lines = await prisma.matchPlayer.findMany({
    where: {
      minutesPlayed: { gt: 0 },
      match: { status: 'FINISHED', seasonId: latest.match.seasonId },
      player: { positions: { some: { group: positionGroup } } },
    },
    select: {
      playerId: true,
      minutesPlayed: true,
      fieldStats: {
        select: {
          goals: true,
          assists: true,
          shotsOnTarget: true,
          keyPasses: true,
          progressivePasses: true,
          dribblesCompleted: true,
          tacklesWon: true,
          interceptions: true,
          recoveries: true,
          clearances: true,
          duelsWon: true,
        },
      },
      gkStats: {
        select: {
          saves: true,
          goalsConceded: true,
          longBallsCompleted: true,
          highClaims: true,
        },
      },
    },
  });

  const aggregates = new Map<number, Aggregate>();
  for (const line of lines) {
    const aggregate = aggregates.get(line.playerId) ?? emptyAggregate(line.playerId);
    aggregate.minutes += line.minutesPlayed;
    const f = line.fieldStats;
    addMetric(aggregate, 'goals', f?.goals, line.minutesPlayed);
    addMetric(aggregate, 'assists', f?.assists, line.minutesPlayed);
    addMetric(aggregate, 'shotsOnTarget', f?.shotsOnTarget, line.minutesPlayed);
    addMetric(aggregate, 'keyPasses', f?.keyPasses, line.minutesPlayed);
    addMetric(aggregate, 'progressivePasses', f?.progressivePasses, line.minutesPlayed);
    addMetric(aggregate, 'dribblesCompleted', f?.dribblesCompleted, line.minutesPlayed);
    addMetric(aggregate, 'tacklesWon', f?.tacklesWon, line.minutesPlayed);
    addMetric(aggregate, 'interceptions', f?.interceptions, line.minutesPlayed);
    addMetric(aggregate, 'recoveries', f?.recoveries, line.minutesPlayed);
    addMetric(aggregate, 'clearances', f?.clearances, line.minutesPlayed);
    addMetric(aggregate, 'duelsWon', f?.duelsWon, line.minutesPlayed);
    const g = line.gkStats;
    addMetric(aggregate, 'saves', g?.saves, line.minutesPlayed);
    addMetric(aggregate, 'goalsConceded', g?.goalsConceded, line.minutesPlayed);
    addMetric(aggregate, 'longBallsCompleted', g?.longBallsCompleted, line.minutesPlayed);
    addMetric(aggregate, 'highClaims', g?.highClaims, line.minutesPlayed);
    aggregates.set(line.playerId, aggregate);
  }

  const strictPool = [...aggregates.values()].filter((item) => item.minutes >= 450);
  const minimumMinutes = strictPool.length >= 8 ? 450 : 180;
  const pool = [...aggregates.values()].filter((item) => item.minutes >= minimumMinutes);
  const target = aggregates.get(playerId);
  if (target == null) {
    return {
      competition: latest.match.season.competition.name,
      seasonYear: latest.match.season.year,
      positionGroup,
      minimumMinutes,
      players: [],
    };
  }

  const metrics = POSITION_METRICS[positionGroup];
  const distributions = new Map<MetricKey, number[]>();
  for (const key of metrics) {
    distributions.set(
      key,
      pool.map((item) => per90(item, key)).filter((value): value is number => value != null),
    );
  }

  const targetVector = metrics.map((key) => {
    const value = per90(target, key);
    const values = distributions.get(key) ?? [];
    if (value == null || values.length < 3) return null;
    return percentile(value, values, positionGroup === 'GK' && key === 'goalsConceded');
  });

  const scored = pool
    .filter((candidate) => candidate.playerId !== playerId)
    .map((candidate) => {
      let distanceSquared = 0;
      let compared = 0;
      metrics.forEach((key, index) => {
        const targetPercentile = targetVector[index];
        const value = per90(candidate, key);
        const values = distributions.get(key) ?? [];
        if (targetPercentile == null || value == null || values.length < 3) return;
        const candidatePercentile = percentile(value, values, positionGroup === 'GK' && key === 'goalsConceded');
        distanceSquared += (targetPercentile - candidatePercentile) ** 2;
        compared += 1;
      });
      if (compared < Math.min(3, metrics.length)) return null;
      const rms = Math.sqrt(distanceSquared / compared);
      return { playerId: candidate.playerId, similarity: Math.max(0, Math.round((1 - rms) * 100)), minutes: candidate.minutes };
    })
    .filter((item): item is { playerId: number; similarity: number; minutes: number } => item != null)
    .sort((a, b) => b.similarity - a.similarity || b.minutes - a.minutes)
    .slice(0, 6);

  const playerIds = scored.map((item) => item.playerId);
  const players = playerIds.length === 0
    ? []
    : await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: {
          id: true,
          slug: true,
          fullName: true,
          knownAs: true,
          photoUrl: true,
          currentTeam: { select: { name: true, crestUrl: true } },
        },
      });
  const byId = new Map(players.map((player) => [player.id, player]));

  return {
    competition: latest.match.season.competition.name,
    seasonYear: latest.match.season.year,
    positionGroup,
    minimumMinutes,
    players: scored.flatMap((score) => {
      const player = byId.get(score.playerId);
      return player == null
        ? []
        : [{
            id: player.id,
            slug: player.slug,
            name: player.knownAs ?? player.fullName,
            photoUrl: player.photoUrl,
            team: player.currentTeam?.name ?? null,
            teamCrestUrl: player.currentTeam?.crestUrl ?? null,
            similarity: score.similarity,
            minutes: score.minutes,
          }];
    }),
  };
}

const cachedSimilarPlayers = unstable_cache(querySimilarPlayers, ['similar-players-v1'], {
  revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG],
});

export function getSimilarPlayers(playerId: number, positionGroup: PositionGroup): Promise<SimilarPlayersResult> {
  return cachedSimilarPlayers(playerId, positionGroup);
}
