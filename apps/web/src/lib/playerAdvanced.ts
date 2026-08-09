import { PositionGroup, prisma } from '@futstats/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG, FOOTBALL_DATA_REVALIDATE_SECONDS } from '@/lib/cache';

export type AdvancedMetric = {
  key: string;
  label: string;
  value: number | null;
  displayValue: string;
  percentile: number | null;
  lowerIsBetter: boolean;
};

export type PlayerAdvancedAnalytics = {
  season: { competition: string; year: number; isCurrent: boolean } | null;
  positionGroup: PositionGroup;
  minutes: number;
  appearances: number;
  starts: number;
  avgRating: number | null;
  cohortSize: number;
  cohortMinimumMinutes: number;
  metrics: AdvancedMetric[];
  form: Array<{
    matchId: number;
    date: string;
    rival: string;
    rating: number | null;
    contribution: number | null;
  }>;
};

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
  | 'cleanSheets'
  | 'longBallsCompleted'
  | 'highClaims';

type MetricDef = { key: MetricKey | 'savePercentage'; label: string; lowerIsBetter?: boolean; rate?: boolean };

type RunningMetric = { sum: number; minutes: number; seen: boolean };
type Aggregate = {
  playerId: number;
  minutes: number;
  appearances: number;
  starts: number;
  ratingTotal: number;
  ratingCount: number;
  metrics: Record<MetricKey, RunningMetric>;
  savesForRate: number;
  shotsOnTargetFacedForRate: number;
  saveRateSeen: boolean;
};

const METRIC_KEYS: MetricKey[] = [
  'goals', 'assists', 'shotsOnTarget', 'keyPasses', 'progressivePasses', 'dribblesCompleted',
  'tacklesWon', 'interceptions', 'recoveries', 'clearances', 'duelsWon', 'saves',
  'goalsConceded', 'cleanSheets', 'longBallsCompleted', 'highClaims',
];

const FIELD_METRICS: Record<Exclude<PositionGroup, 'GK'>, MetricDef[]> = {
  FW: [
    { key: 'goals', label: 'Goles /90' },
    { key: 'assists', label: 'Asistencias /90' },
    { key: 'shotsOnTarget', label: 'Tiros a puerta /90' },
    { key: 'keyPasses', label: 'Pases clave /90' },
    { key: 'dribblesCompleted', label: 'Regates /90' },
    { key: 'duelsWon', label: 'Duelos ganados /90' },
  ],
  MF: [
    { key: 'assists', label: 'Asistencias /90' },
    { key: 'keyPasses', label: 'Pases clave /90' },
    { key: 'progressivePasses', label: 'Pases progresivos /90' },
    { key: 'recoveries', label: 'Recuperaciones /90' },
    { key: 'tacklesWon', label: 'Entradas ganadas /90' },
    { key: 'duelsWon', label: 'Duelos ganados /90' },
  ],
  DF: [
    { key: 'tacklesWon', label: 'Entradas ganadas /90' },
    { key: 'interceptions', label: 'Intercepciones /90' },
    { key: 'recoveries', label: 'Recuperaciones /90' },
    { key: 'clearances', label: 'Despejes /90' },
    { key: 'duelsWon', label: 'Duelos ganados /90' },
    { key: 'progressivePasses', label: 'Pases progresivos /90' },
  ],
};

const GK_METRICS: MetricDef[] = [
  { key: 'saves', label: 'Paradas /90' },
  { key: 'savePercentage', label: '% paradas', rate: true },
  { key: 'goalsConceded', label: 'Goles encajados /90', lowerIsBetter: true },
  { key: 'cleanSheets', label: 'Porterías a cero /90' },
  { key: 'longBallsCompleted', label: 'Balones largos /90' },
  { key: 'highClaims', label: 'Balones aéreos /90' },
];

function emptyAggregate(playerId: number): Aggregate {
  return {
    playerId,
    minutes: 0,
    appearances: 0,
    starts: 0,
    ratingTotal: 0,
    ratingCount: 0,
    metrics: Object.fromEntries(METRIC_KEYS.map((key) => [key, { sum: 0, minutes: 0, seen: false }])) as Record<MetricKey, RunningMetric>,
    savesForRate: 0,
    shotsOnTargetFacedForRate: 0,
    saveRateSeen: false,
  };
}

function addMetric(aggregate: Aggregate, key: MetricKey, value: number | boolean | null | undefined, minutes: number) {
  if (value == null) return;
  const metric = aggregate.metrics[key];
  metric.seen = true;
  metric.sum += typeof value === 'boolean' ? (value ? 1 : 0) : value;
  metric.minutes += minutes;
}

function per90(aggregate: Aggregate, key: MetricKey): number | null {
  const metric = aggregate.metrics[key];
  if (!metric.seen || metric.minutes <= 0) return null;
  return Math.round((metric.sum * 90 / metric.minutes) * 100) / 100;
}

function savePercentage(aggregate: Aggregate): number | null {
  if (!aggregate.saveRateSeen || aggregate.shotsOnTargetFacedForRate <= 0) return null;
  return Math.round((aggregate.savesForRate / aggregate.shotsOnTargetFacedForRate) * 1000) / 10;
}

function metricValue(aggregate: Aggregate, definition: MetricDef): number | null {
  return definition.key === 'savePercentage' ? savePercentage(aggregate) : per90(aggregate, definition.key);
}

function percentile(value: number | null, values: number[], lowerIsBetter = false): number | null {
  if (value == null || values.length < 3) return null;
  const rank = lowerIsBetter
    ? values.filter((candidate) => candidate >= value).length
    : values.filter((candidate) => candidate <= value).length;
  return Math.max(1, Math.min(99, Math.round((rank / values.length) * 100)));
}

function formatMetric(value: number | null, rate = false): string {
  if (value == null) return '—';
  return rate ? `${value.toFixed(1)}%` : value.toFixed(2);
}

function fetchCohort(seasonId: number, positionGroup: PositionGroup) {
  return prisma.matchPlayer.findMany({
    where: {
      minutesPlayed: { gt: 0 },
      match: { status: 'FINISHED', seasonId },
      player: { positions: { some: { group: positionGroup } } },
    },
    select: {
      playerId: true,
      minutesPlayed: true,
      rating: true,
      role: true,
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
          cleanSheet: true,
          shotsOnTargetFaced: true,
          longBallsCompleted: true,
          highClaims: true,
        },
      },
    },
  });
}

type CohortLine = Awaited<ReturnType<typeof fetchCohort>>[number];

function buildAggregates(lines: CohortLine[]): Map<number, Aggregate> {
  const result = new Map<number, Aggregate>();
  for (const line of lines) {
    const aggregate = result.get(line.playerId) ?? emptyAggregate(line.playerId);
    aggregate.minutes += line.minutesPlayed;
    aggregate.appearances += 1;
    if (line.role === 'STARTER') aggregate.starts += 1;
    if (line.rating != null) {
      aggregate.ratingTotal += line.rating;
      aggregate.ratingCount += 1;
    }

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
    addMetric(aggregate, 'cleanSheets', g?.cleanSheet, line.minutesPlayed);
    addMetric(aggregate, 'longBallsCompleted', g?.longBallsCompleted, line.minutesPlayed);
    addMetric(aggregate, 'highClaims', g?.highClaims, line.minutesPlayed);
    if (g?.saves != null && g.shotsOnTargetFaced != null) {
      aggregate.savesForRate += g.saves;
      aggregate.shotsOnTargetFacedForRate += g.shotsOnTargetFaced;
      aggregate.saveRateSeen = true;
    }

    result.set(line.playerId, aggregate);
  }
  return result;
}

async function queryPlayerAdvancedAnalytics(playerId: number, positionGroup: PositionGroup): Promise<PlayerAdvancedAnalytics> {
  const latest = await prisma.matchPlayer.findFirst({
    where: { playerId, minutesPlayed: { gt: 0 }, match: { status: 'FINISHED' } },
    orderBy: { match: { kickoffAt: 'desc' } },
    select: {
      match: {
        select: {
          seasonId: true,
          season: { select: { year: true, isCurrent: true, competition: { select: { name: true } } } },
        },
      },
    },
  });

  if (latest == null) {
    return { season: null, positionGroup, minutes: 0, appearances: 0, starts: 0, avgRating: null, cohortSize: 0, cohortMinimumMinutes: 450, metrics: [], form: [] };
  }

  const [cohortLines, formLines] = await Promise.all([
    fetchCohort(latest.match.seasonId, positionGroup),
    prisma.matchPlayer.findMany({
      where: { playerId, minutesPlayed: { gt: 0 }, match: { status: 'FINISHED' } },
      orderBy: { match: { kickoffAt: 'desc' } },
      take: 10,
      select: {
        matchId: true,
        rating: true,
        fieldStats: { select: { goals: true, assists: true } },
        match: {
          select: {
            kickoffAt: true,
            teams: { select: { teamId: true, team: { select: { name: true } } } },
          },
        },
        teamId: true,
      },
    }),
  ]);

  const aggregates = buildAggregates(cohortLines);
  const target = aggregates.get(playerId) ?? emptyAggregate(playerId);
  const strictPool = [...aggregates.values()].filter((item) => item.minutes >= 450);
  const cohortMinimumMinutes = strictPool.length >= 8 ? 450 : 180;
  const pool = [...aggregates.values()].filter((item) => item.minutes >= cohortMinimumMinutes);
  const definitions = positionGroup === 'GK' ? GK_METRICS : FIELD_METRICS[positionGroup];

  const metrics = definitions.map((definition): AdvancedMetric => {
    const value = metricValue(target, definition);
    const peerValues = pool
      .map((item) => metricValue(item, definition))
      .filter((item): item is number => item != null);
    return {
      key: definition.key,
      label: definition.label,
      value,
      displayValue: formatMetric(value, definition.rate),
      percentile: percentile(value, peerValues, definition.lowerIsBetter),
      lowerIsBetter: definition.lowerIsBetter ?? false,
    };
  });

  return {
    season: {
      competition: latest.match.season.competition.name,
      year: latest.match.season.year,
      isCurrent: latest.match.season.isCurrent,
    },
    positionGroup,
    minutes: target.minutes,
    appearances: target.appearances,
    starts: target.starts,
    avgRating: target.ratingCount > 0 ? Math.round((target.ratingTotal / target.ratingCount) * 100) / 100 : null,
    cohortSize: pool.length,
    cohortMinimumMinutes,
    metrics,
    form: formLines.map((line) => ({
      matchId: line.matchId,
      date: line.match.kickoffAt.toISOString(),
      rival: line.match.teams.find((entry) => entry.teamId !== line.teamId)?.team.name ?? 'Rival',
      rating: line.rating,
      contribution: line.fieldStats == null || (line.fieldStats.goals == null && line.fieldStats.assists == null)
        ? null
        : (line.fieldStats.goals ?? 0) + (line.fieldStats.assists ?? 0),
    })),
  };
}

const cachedPlayerAdvancedAnalytics = unstable_cache(
  queryPlayerAdvancedAnalytics,
  ['player-advanced-analytics-v1'],
  { revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS, tags: [FOOTBALL_DATA_CACHE_TAG] },
);

export function getPlayerAdvancedAnalytics(playerId: number, positionGroup: PositionGroup): Promise<PlayerAdvancedAnalytics> {
  return cachedPlayerAdvancedAnalytics(playerId, positionGroup);
}
