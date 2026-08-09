import { prisma } from '@futstats/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG, FOOTBALL_DATA_REVALIDATE_SECONDS } from '@/lib/cache';

type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW';

type MetricKey =
  | 'goals'
  | 'assists'
  | 'shotsOnTarget'
  | 'keyPasses'
  | 'duelsWon'
  | 'tacklesWon'
  | 'interceptions'
  | 'progressivePasses'
  | 'saves'
  | 'goalsConceded'
  | 'savePercentage';

export interface AdvancedMetric {
  key: MetricKey;
  label: string;
  value: number | null;
  percentile: number | null;
  unit: 'per90' | 'percent';
  lowerIsBetter?: boolean;
}

export interface SeasonEvolutionPoint {
  season: string;
  competition: string;
  minutes: number;
  appearances: number;
  avgRating: number | null;
  goals: number | null;
  assists: number | null;
  saves: number | null;
}

export interface PlayerAdvancedStats {
  competition: { name: string; slug: string } | null;
  position: PositionGroup | null;
  minutes: number;
  sampleSize: number;
  metrics: AdvancedMetric[];
  evolution: SeasonEvolutionPoint[];
}

const LABELS: Record<MetricKey, string> = {
  goals: 'Goles',
  assists: 'Asistencias',
  shotsOnTarget: 'Tiros a puerta',
  keyPasses: 'Pases clave',
  duelsWon: 'Duelos ganados',
  tacklesWon: 'Entradas ganadas',
  interceptions: 'Intercepciones',
  progressivePasses: 'Pases progresivos',
  saves: 'Paradas',
  goalsConceded: 'Goles encajados',
  savePercentage: '% paradas',
};

const POSITION_METRICS: Record<PositionGroup, MetricKey[]> = {
  GK: ['saves', 'savePercentage', 'goalsConceded'],
  DF: ['tacklesWon', 'interceptions', 'duelsWon', 'progressivePasses', 'keyPasses'],
  MF: ['keyPasses', 'progressivePasses', 'duelsWon', 'tacklesWon', 'assists'],
  FW: ['goals', 'assists', 'shotsOnTarget', 'keyPasses', 'duelsWon'],
};

const LOWER_IS_BETTER = new Set<MetricKey>(['goalsConceded']);

function sum(values: Array<number | null | undefined>): number | null {
  const present = values.filter((value): value is number => value != null);
  return present.length === 0 ? null : present.reduce((total, value) => total + value, 0);
}

function per90(total: number | null, minutes: number): number | null {
  if (total == null || minutes <= 0) return null;
  return Number(((total * 90) / minutes).toFixed(2));
}

function percentile(value: number, cohort: number[], lowerIsBetter: boolean): number | null {
  if (cohort.length < 5) return null;
  const ordered = [...cohort].sort((a, b) => a - b);
  const below = ordered.filter((item) => item < value).length;
  const equal = ordered.filter((item) => item === value).length;
  const raw = ((below + equal * 0.5) / ordered.length) * 100;
  const result = lowerIsBetter ? 100 - raw : raw;
  return Math.max(1, Math.min(99, Math.round(result)));
}

type Row = Awaited<ReturnType<typeof fetchCompetitionRows>>[number];

function fetchCompetitionRows(competitionId: number, position: PositionGroup) {
  return prisma.matchPlayer.findMany({
    where: {
      minutesPlayed: { gt: 0 },
      match: { status: 'FINISHED', season: { isCurrent: true, competitionId } },
      player: { positions: { some: { group: position, isPrimary: true } } },
    },
    select: {
      playerId: true,
      minutesPlayed: true,
      rating: true,
      fieldStats: {
        select: {
          goals: true,
          assists: true,
          shotsOnTarget: true,
          keyPasses: true,
          duelsWon: true,
          tacklesWon: true,
          interceptions: true,
          progressivePasses: true,
        },
      },
      gkStats: { select: { saves: true, goalsConceded: true, shotsOnTargetFaced: true } },
    },
    take: 12000,
  });
}

function aggregateRows(rows: Row[]) {
  const minutes = rows.reduce((total, row) => total + row.minutesPlayed, 0);
  const totals = {
    goals: sum(rows.map((row) => row.fieldStats?.goals)),
    assists: sum(rows.map((row) => row.fieldStats?.assists)),
    shotsOnTarget: sum(rows.map((row) => row.fieldStats?.shotsOnTarget)),
    keyPasses: sum(rows.map((row) => row.fieldStats?.keyPasses)),
    duelsWon: sum(rows.map((row) => row.fieldStats?.duelsWon)),
    tacklesWon: sum(rows.map((row) => row.fieldStats?.tacklesWon)),
    interceptions: sum(rows.map((row) => row.fieldStats?.interceptions)),
    progressivePasses: sum(rows.map((row) => row.fieldStats?.progressivePasses)),
    saves: sum(rows.map((row) => row.gkStats?.saves)),
    goalsConceded: sum(rows.map((row) => row.gkStats?.goalsConceded)),
    shotsOnTargetFaced: sum(rows.map((row) => row.gkStats?.shotsOnTargetFaced)),
  };

  const values: Record<MetricKey, number | null> = {
    goals: per90(totals.goals, minutes),
    assists: per90(totals.assists, minutes),
    shotsOnTarget: per90(totals.shotsOnTarget, minutes),
    keyPasses: per90(totals.keyPasses, minutes),
    duelsWon: per90(totals.duelsWon, minutes),
    tacklesWon: per90(totals.tacklesWon, minutes),
    interceptions: per90(totals.interceptions, minutes),
    progressivePasses: per90(totals.progressivePasses, minutes),
    saves: per90(totals.saves, minutes),
    goalsConceded: per90(totals.goalsConceded, minutes),
    savePercentage:
      totals.saves != null && totals.shotsOnTargetFaced != null && totals.shotsOnTargetFaced > 0
        ? Number(((totals.saves / totals.shotsOnTargetFaced) * 100).toFixed(1))
        : null,
  };

  return { minutes, values };
}

async function queryAdvancedStats(playerId: number): Promise<PlayerAdvancedStats> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      positions: { where: { isPrimary: true }, take: 1, select: { group: true } },
      matchPlayers: {
        where: { minutesPlayed: { gt: 0 }, match: { status: 'FINISHED' } },
        orderBy: { match: { kickoffAt: 'desc' } },
        select: {
          minutesPlayed: true,
          rating: true,
          fieldStats: { select: { goals: true, assists: true } },
          gkStats: { select: { saves: true } },
          match: {
            select: {
              season: {
                select: {
                  year: true,
                  isCurrent: true,
                  competitionId: true,
                  competition: { select: { name: true, slug: true, seasonFormat: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const position = (player?.positions[0]?.group as PositionGroup | undefined) ?? null;
  const latestCurrent = player?.matchPlayers.find((row) => row.match.season.isCurrent) ?? null;
  const competition = latestCurrent?.match.season.competition ?? null;

  const evolutionMap = new Map<string, { season: string; competition: string; rows: NonNullable<typeof player>['matchPlayers'] }>();
  for (const row of player?.matchPlayers ?? []) {
    const season = row.match.season;
    const label = season.competition.seasonFormat === 'CALENDAR_YEAR' ? String(season.year) : `${season.year}/${String(season.year + 1).slice(-2)}`;
    const key = `${season.competitionId}:${season.year}`;
    const existing = evolutionMap.get(key);
    if (existing) existing.rows.push(row);
    else evolutionMap.set(key, { season: label, competition: season.competition.name, rows: [row] });
  }

  const evolution = [...evolutionMap.values()].slice(0, 5).map((group) => {
    const minutes = group.rows.reduce((total, row) => total + row.minutesPlayed, 0);
    const ratings = group.rows.map((row) => row.rating).filter((value): value is number => value != null);
    return {
      season: group.season,
      competition: group.competition,
      minutes,
      appearances: group.rows.length,
      avgRating: ratings.length > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)) : null,
      goals: sum(group.rows.map((row) => row.fieldStats?.goals)),
      assists: sum(group.rows.map((row) => row.fieldStats?.assists)),
      saves: sum(group.rows.map((row) => row.gkStats?.saves)),
    };
  });

  if (!position || !competition || !latestCurrent) {
    return { competition: competition == null ? null : { name: competition.name, slug: competition.slug }, position, minutes: 0, sampleSize: 0, metrics: [], evolution };
  }

  const rows = await fetchCompetitionRows(latestCurrent.match.season.competitionId, position);
  const byPlayer = new Map<number, Row[]>();
  for (const row of rows) {
    const list = byPlayer.get(row.playerId) ?? [];
    list.push(row);
    byPlayer.set(row.playerId, list);
  }

  const aggregates = [...byPlayer.entries()]
    .map(([id, playerRows]) => ({ id, ...aggregateRows(playerRows) }))
    .filter((item) => item.minutes >= 450);
  const self = aggregates.find((item) => item.id === playerId) ?? (() => {
    const ownRows = byPlayer.get(playerId) ?? [];
    return { id: playerId, ...aggregateRows(ownRows) };
  })();

  const metricKeys = POSITION_METRICS[position];
  const metrics = metricKeys.map((key) => {
    const value = self.values[key];
    const cohort = aggregates.map((item) => item.values[key]).filter((item): item is number => item != null);
    return {
      key,
      label: LABELS[key],
      value,
      percentile: value == null ? null : percentile(value, cohort, LOWER_IS_BETTER.has(key)),
      unit: key === 'savePercentage' ? 'percent' as const : 'per90' as const,
      ...(LOWER_IS_BETTER.has(key) ? { lowerIsBetter: true } : {}),
    };
  });

  return {
    competition: { name: competition.name, slug: competition.slug },
    position,
    minutes: self.minutes,
    sampleSize: aggregates.length,
    metrics,
    evolution,
  };
}

const cached = unstable_cache(queryAdvancedStats, ['player-advanced-stats-v1'], {
  revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG],
});

export function getPlayerAdvancedStats(playerId: number): Promise<PlayerAdvancedStats> {
  return cached(playerId);
}
