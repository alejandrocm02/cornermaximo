/**
 * Servicio "últimos 5 partidos": detalle por partido + resumen agregado + tendencia.
 * Solo cuentan partidos con minutos > 0. Los BENCH_UNUSED se listan aparte.
 */
import { prisma } from '@futstats/db';
import {
  aggregateFieldPlayer,
  aggregateGoalkeeper,
  computeTrend,
  type GoalkeeperMatchLine,
  type PlayerMatchLine,
  type RecentSummary,
  type TrendResult,
} from '@futstats/stats';
import { RECENT_MATCHES_WINDOW } from '@futstats/shared';

export interface RecentMatchDetail {
  matchId: number;
  date: string;
  competition: string;
  round: string | null;
  ownTeam: string;
  rival: string;
  isHome: boolean;
  result: string;
  minutes: number;
  role: string;
  positionPlayed: string | null;
  rating: number | null;
  goals: number | null;
  assists: number | null;
  yellowCards: number | null;
  redCards: number | null;
  saves: number | null;
  goalsConceded: number | null;
}

export interface LastMatchesResponse {
  isGoalkeeper: boolean;
  matches: RecentMatchDetail[];
  benchOnly: Array<{ matchId: number; date: string; rival: string }>;
  summary: RecentSummary;
  trends: Record<string, TrendResult>;
}

type Mp = Awaited<ReturnType<typeof fetchPlayed>>[number];

export type ComparisonWindow = number | 'season';

function fetchPlayed(playerId: number, take?: number) {
  return prisma.matchPlayer.findMany({
    where: {
      playerId,
      minutesPlayed: { gt: 0 },
      match: { status: 'FINISHED' },
    },
    include: {
      fieldStats: true,
      gkStats: true,
      team: { select: { name: true } },
      match: {
        include: {
          season: { include: { competition: { select: { name: true } } } },
          teams: { include: { team: { select: { name: true } } } },
        },
      },
    },
    orderBy: { match: { kickoffAt: 'desc' } },
    ...(take != null ? { take } : {}),
  });
}

function toDetail(mp: Mp): RecentMatchDetail {
  const own = mp.match.teams.find((t) => t.teamId === mp.teamId);
  const rival = mp.match.teams.find((t) => t.teamId !== mp.teamId);
  return {
    matchId: mp.matchId,
    date: mp.match.kickoffAt.toISOString(),
    competition: mp.match.season.competition.name,
    round: mp.match.round,
    ownTeam: own?.team.name ?? '',
    rival: rival?.team.name ?? '',
    isHome: own?.isHome ?? false,
    result: `${own?.goals ?? '-'}–${rival?.goals ?? '-'}`,
    minutes: mp.minutesPlayed,
    role: mp.role,
    positionPlayed: mp.positionPlayed,
    rating: mp.rating,
    goals: mp.fieldStats?.goals ?? null,
    assists: mp.fieldStats?.assists ?? null,
    yellowCards: mp.fieldStats?.yellowCards ?? null,
    redCards: mp.fieldStats?.redCards ?? null,
    saves: mp.gkStats?.saves ?? null,
    goalsConceded: mp.gkStats?.goalsConceded ?? null,
  };
}

function toFieldLine(mp: Mp): PlayerMatchLine {
  const s = mp.fieldStats;
  return {
    matchId: mp.matchId,
    minutes: mp.minutesPlayed,
    rating: mp.rating,
    goals: s?.goals ?? null,
    assists: s?.assists ?? null,
    shotsTotal: s?.shotsTotal ?? null,
    shotsOnTarget: s?.shotsOnTarget ?? null,
    passesAttempted: s?.passesAttempted ?? null,
    passesCompleted: s?.passesCompleted ?? null,
    keyPasses: s?.keyPasses ?? null,
    foulsCommitted: s?.foulsCommitted ?? null,
    foulsDrawn: s?.foulsDrawn ?? null,
    tacklesWon: s?.tacklesWon ?? null,
    interceptions: s?.interceptions ?? null,
    recoveries: s?.recoveries ?? null,
    duelsTotal: s?.duelsTotal ?? null,
    duelsWon: s?.duelsWon ?? null,
    yellowCards: s?.yellowCards ?? null,
    redCards: s?.redCards ?? null,
  };
}

function toGkLine(mp: Mp): GoalkeeperMatchLine {
  const s = mp.gkStats;
  return {
    matchId: mp.matchId,
    minutes: mp.minutesPlayed,
    rating: mp.rating,
    goalsConceded: s?.goalsConceded ?? null,
    cleanSheet: s?.cleanSheet ?? null,
    shotsOnTargetFaced: s?.shotsOnTargetFaced ?? null,
    saves: s?.saves ?? null,
    penaltiesSaved: s?.penaltiesSaved ?? null,
  };
}

const sumOrNull = (values: Array<number | null>): number | null => {
  const present = values.filter((v): v is number => v != null);
  return present.length > 0 ? present.reduce((a, b) => a + b, 0) : null;
};

export async function getLastMatches(
  playerId: number,
  isGoalkeeper: boolean,
  window: ComparisonWindow = RECENT_MATCHES_WINDOW,
): Promise<LastMatchesResponse> {
  // 'season' = todos los partidos jugados disponibles (sin ventana previa para tendencias)
  const played = await fetchPlayed(playerId, window === 'season' ? undefined : window * 2);
  const recent = window === 'season' ? played : played.slice(0, window);
  const previous = window === 'season' ? [] : played.slice(window);

  // Convocados sin minutos dentro del rango temporal reciente (informativos)
  const newestDate = recent[0]?.match.kickoffAt;
  const oldestDate = recent[recent.length - 1]?.match.kickoffAt;
  const bench =
    newestDate != null && oldestDate != null
      ? await prisma.matchPlayer.findMany({
          where: {
            playerId,
            role: 'BENCH_UNUSED',
            match: { status: 'FINISHED', kickoffAt: { gte: oldestDate, lte: newestDate } },
          },
          include: { match: { include: { teams: { include: { team: { select: { name: true } } } } } } },
        })
      : [];

  const minutes = (list: Mp[]) => list.reduce((a, m) => a + m.minutesPlayed, 0);

  let summary: RecentSummary;
  const trends: Record<string, TrendResult> = {};

  if (isGoalkeeper) {
    const recentLines = recent.map(toGkLine);
    const prevLines = previous.map(toGkLine);
    summary = aggregateGoalkeeper(recentLines);
    trends.saves = computeTrend({
      recentTotal: sumOrNull(recentLines.map((l) => l.saves)),
      recentMinutes: minutes(recent),
      previousTotal: sumOrNull(prevLines.map((l) => l.saves)),
      previousMinutes: minutes(previous),
    });
    trends.goalsConceded = computeTrend({
      recentTotal: sumOrNull(recentLines.map((l) => l.goalsConceded)),
      recentMinutes: minutes(recent),
      previousTotal: sumOrNull(prevLines.map((l) => l.goalsConceded)),
      previousMinutes: minutes(previous),
      lowerIsBetter: true,
    });
  } else {
    const recentLines = recent.map(toFieldLine);
    const prevLines = previous.map(toFieldLine);
    summary = aggregateFieldPlayer(recentLines);
    trends.goalContributions = computeTrend({
      recentTotal: sumOrNull(recentLines.map((l) => sumOrNull([l.goals, l.assists]))),
      recentMinutes: minutes(recent),
      previousTotal: sumOrNull(prevLines.map((l) => sumOrNull([l.goals, l.assists]))),
      previousMinutes: minutes(previous),
    });
    trends.keyPasses = computeTrend({
      recentTotal: sumOrNull(recentLines.map((l) => l.keyPasses)),
      recentMinutes: minutes(recent),
      previousTotal: sumOrNull(prevLines.map((l) => l.keyPasses)),
      previousMinutes: minutes(previous),
    });
  }

  return {
    isGoalkeeper,
    matches: recent.map(toDetail),
    benchOnly: bench.map((b) => ({
      matchId: b.matchId,
      date: b.match.kickoffAt.toISOString(),
      rival: b.match.teams.find((t) => t.teamId !== b.teamId)?.team.name ?? '',
    })),
    summary,
    trends,
  };
}
