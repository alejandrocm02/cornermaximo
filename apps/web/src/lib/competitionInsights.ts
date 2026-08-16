import { prisma } from '@cornermaximo/db';
import type { MatchStatus } from '@cornermaximo/shared';
import { unstable_cache } from 'next/cache';
import {
  FOOTBALL_DATA_CACHE_TAG,
  FOOTBALL_DATA_REVALIDATE_SECONDS,
} from '@/lib/cache';

export type FormResult = 'W' | 'D' | 'L';

export interface InsightMatch {
  id: number;
  kickoffAt: string;
  status: MatchStatus;
  round: string | null;
  season: {
    year: number;
    competition: { name: string; slug: string };
  };
  teams: Array<{
    isHome: boolean;
    goals: number | null;
    penaltyGoals: number | null;
    team: {
      id: number;
      name: string;
      slug: string;
      crestUrl: string | null;
    };
  }>;
}

export interface SplitPerformance {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  pointsPerGame: number | null;
}

export interface PlayerLeader {
  slug: string;
  name: string;
  photoUrl: string | null;
  teamName: string | null;
  teamSlug: string | null;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
}

export interface TeamInsights {
  form: FormResult[];
  recentMatches: InsightMatch[];
  nextMatch: InsightMatch | null;
  home: SplitPerformance;
  away: SplitPerformance;
  scorers: PlayerLeader[];
  assisters: PlayerLeader[];
}

export interface LeagueSplitRow {
  team: {
    id: number;
    name: string;
    slug: string;
    crestUrl: string | null;
  };
  home: SplitPerformance;
  away: SplitPerformance;
  totalPoints: number;
}

export interface LeagueInsights {
  recentMatches: InsightMatch[];
  nextMatch: InsightMatch | null;
  scorers: PlayerLeader[];
  assisters: PlayerLeader[];
  splitTable: LeagueSplitRow[];
}

type RawPlayerLeader = {
  slug: string;
  name: string;
  photoUrl: string | null;
  teamName: string | null;
  teamSlug: string | null;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
};

type RawSplit = {
  teamId: number;
  teamName: string;
  teamSlug: string;
  crestUrl: string | null;
  isHome: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

const EMPTY_SPLIT: SplitPerformance = {
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  points: 0,
  pointsPerGame: null,
};

function normalizeSplit(row: RawSplit | undefined): SplitPerformance {
  if (row == null) return { ...EMPTY_SPLIT };
  return {
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    points: row.points,
    pointsPerGame:
      row.played > 0 ? Math.round((row.points / row.played) * 100) / 100 : null,
  };
}

function serializeMatch(match: {
  id: number;
  kickoffAt: Date;
  status: string;
  round: string | null;
  season: {
    year: number;
    competition: { name: string; slug: string };
  };
  teams: Array<{
    isHome: boolean;
    goals: number | null;
    penaltyGoals: number | null;
    team: {
      id: number;
      name: string;
      slug: string;
      crestUrl: string | null;
    };
  }>;
}): InsightMatch {
  return {
    ...match,
    kickoffAt: match.kickoffAt.toISOString(),
    status: match.status as MatchStatus,
  };
}

function resultForTeam(match: InsightMatch, teamId: number): FormResult | null {
  const own = match.teams.find((entry) => entry.team.id === teamId);
  const opponent = match.teams.find((entry) => entry.team.id !== teamId);
  if (own?.goals == null || opponent?.goals == null) return null;
  if (own.goals > opponent.goals) return 'W';
  if (own.goals < opponent.goals) return 'L';
  return 'D';
}

async function playerLeaders(seasonId: number, teamId?: number): Promise<RawPlayerLeader[]> {
  if (teamId != null) {
    return prisma.$queryRaw<RawPlayerLeader[]>`
      SELECT
        p.slug,
        COALESCE(p."knownAs", p."fullName") AS name,
        p."photoUrl" AS "photoUrl",
        t.name AS "teamName",
        t.slug AS "teamSlug",
        COUNT(*) FILTER (WHERE mp."minutesPlayed" > 0)::int AS appearances,
        COALESCE(SUM(mp."minutesPlayed"), 0)::int AS minutes,
        COALESCE(SUM(pms.goals), 0)::int AS goals,
        COALESCE(SUM(pms.assists), 0)::int AS assists
      FROM "MatchPlayer" mp
      JOIN "Match" m ON m.id = mp."matchId"
      JOIN "Player" p ON p.id = mp."playerId"
      JOIN "Team" t ON t.id = mp."teamId"
      LEFT JOIN "PlayerMatchStatistics" pms ON pms."matchPlayerId" = mp.id
      WHERE m."seasonId" = ${seasonId}
        AND m.status = 'FINISHED'
        AND mp."teamId" = ${teamId}
      GROUP BY p.id, p.slug, p."knownAs", p."fullName", p."photoUrl", t.name, t.slug
      HAVING COALESCE(SUM(pms.goals), 0) > 0
          OR COALESCE(SUM(pms.assists), 0) > 0
      ORDER BY goals DESC, assists DESC, minutes DESC, name ASC
      LIMIT 20
    `;
  }

  return prisma.$queryRaw<RawPlayerLeader[]>`
    SELECT
      p.slug,
      COALESCE(p."knownAs", p."fullName") AS name,
      p."photoUrl" AS "photoUrl",
      t.name AS "teamName",
      t.slug AS "teamSlug",
      COUNT(*) FILTER (WHERE mp."minutesPlayed" > 0)::int AS appearances,
      COALESCE(SUM(mp."minutesPlayed"), 0)::int AS minutes,
      COALESCE(SUM(pms.goals), 0)::int AS goals,
      COALESCE(SUM(pms.assists), 0)::int AS assists
    FROM "MatchPlayer" mp
    JOIN "Match" m ON m.id = mp."matchId"
    JOIN "Player" p ON p.id = mp."playerId"
    JOIN "Team" t ON t.id = mp."teamId"
    LEFT JOIN "PlayerMatchStatistics" pms ON pms."matchPlayerId" = mp.id
    WHERE m."seasonId" = ${seasonId}
      AND m.status = 'FINISHED'
    GROUP BY p.id, p.slug, p."knownAs", p."fullName", p."photoUrl", t.name, t.slug
    HAVING COALESCE(SUM(pms.goals), 0) > 0
        OR COALESCE(SUM(pms.assists), 0) > 0
    ORDER BY goals DESC, assists DESC, minutes DESC, name ASC
    LIMIT 40
  `;
}

async function splitPerformance(seasonId: number, teamId?: number): Promise<RawSplit[]> {
  if (teamId != null) {
    return prisma.$queryRaw<RawSplit[]>`
      SELECT
        t.id AS "teamId",
        t.name AS "teamName",
        t.slug AS "teamSlug",
        t."crestUrl" AS "crestUrl",
        mt."isHome" AS "isHome",
        COUNT(*)::int AS played,
        COUNT(*) FILTER (WHERE mt.goals > opponent.goals)::int AS won,
        COUNT(*) FILTER (WHERE mt.goals = opponent.goals)::int AS drawn,
        COUNT(*) FILTER (WHERE mt.goals < opponent.goals)::int AS lost,
        COALESCE(SUM(mt.goals), 0)::int AS "goalsFor",
        COALESCE(SUM(opponent.goals), 0)::int AS "goalsAgainst",
        COALESCE(SUM(
          CASE
            WHEN mt.goals > opponent.goals THEN 3
            WHEN mt.goals = opponent.goals THEN 1
            ELSE 0
          END
        ), 0)::int AS points
      FROM "MatchTeam" mt
      JOIN "Match" m ON m.id = mt."matchId"
      JOIN "MatchTeam" opponent
        ON opponent."matchId" = mt."matchId" AND opponent.id <> mt.id
      JOIN "Team" t ON t.id = mt."teamId"
      WHERE m."seasonId" = ${seasonId}
        AND m.status = 'FINISHED'
        AND mt."teamId" = ${teamId}
        AND mt.goals IS NOT NULL
        AND opponent.goals IS NOT NULL
      GROUP BY t.id, t.name, t.slug, t."crestUrl", mt."isHome"
      ORDER BY mt."isHome" DESC
    `;
  }

  return prisma.$queryRaw<RawSplit[]>`
    SELECT
      t.id AS "teamId",
      t.name AS "teamName",
      t.slug AS "teamSlug",
      t."crestUrl" AS "crestUrl",
      mt."isHome" AS "isHome",
      COUNT(*)::int AS played,
      COUNT(*) FILTER (WHERE mt.goals > opponent.goals)::int AS won,
      COUNT(*) FILTER (WHERE mt.goals = opponent.goals)::int AS drawn,
      COUNT(*) FILTER (WHERE mt.goals < opponent.goals)::int AS lost,
      COALESCE(SUM(mt.goals), 0)::int AS "goalsFor",
      COALESCE(SUM(opponent.goals), 0)::int AS "goalsAgainst",
      COALESCE(SUM(
        CASE
          WHEN mt.goals > opponent.goals THEN 3
          WHEN mt.goals = opponent.goals THEN 1
          ELSE 0
        END
      ), 0)::int AS points
    FROM "MatchTeam" mt
    JOIN "Match" m ON m.id = mt."matchId"
    JOIN "MatchTeam" opponent
      ON opponent."matchId" = mt."matchId" AND opponent.id <> mt.id
    JOIN "Team" t ON t.id = mt."teamId"
    WHERE m."seasonId" = ${seasonId}
      AND m.status = 'FINISHED'
      AND mt.goals IS NOT NULL
      AND opponent.goals IS NOT NULL
    GROUP BY t.id, t.name, t.slug, t."crestUrl", mt."isHome"
    ORDER BY t.name ASC, mt."isHome" DESC
  `;
}

const matchSelect = {
  id: true,
  kickoffAt: true,
  status: true,
  round: true,
  season: {
    select: {
      year: true,
      competition: { select: { name: true, slug: true } },
    },
  },
  teams: {
    select: {
      isHome: true,
      goals: true,
      penaltyGoals: true,
      team: {
        select: { id: true, name: true, slug: true, crestUrl: true },
      },
    },
  },
} as const;

async function queryTeamInsights(teamId: number, seasonId: number): Promise<TeamInsights> {
  const [recentRows, nextRow, leaders, splitRows] = await Promise.all([
    prisma.match.findMany({
      where: {
        seasonId,
        status: 'FINISHED',
        teams: { some: { teamId } },
      },
      select: matchSelect,
      orderBy: { kickoffAt: 'desc' },
      take: 5,
    }),
    prisma.match.findFirst({
      where: {
        seasonId,
        status: 'SCHEDULED',
        kickoffAt: { gte: new Date() },
        teams: { some: { teamId } },
      },
      select: matchSelect,
      orderBy: { kickoffAt: 'asc' },
    }),
    playerLeaders(seasonId, teamId),
    splitPerformance(seasonId, teamId),
  ]);

  const recentMatches = recentRows.map(serializeMatch);
  const form = recentMatches
    .slice()
    .reverse()
    .map((match) => resultForTeam(match, teamId))
    .filter((result): result is FormResult => result != null);
  const homeRow = splitRows.find((row) => row.isHome);
  const awayRow = splitRows.find((row) => !row.isHome);

  return {
    form,
    recentMatches,
    nextMatch: nextRow == null ? null : serializeMatch(nextRow),
    home: normalizeSplit(homeRow),
    away: normalizeSplit(awayRow),
    scorers: leaders
      .slice()
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.minutes - a.minutes)
      .slice(0, 5),
    assisters: leaders
      .slice()
      .sort((a, b) => b.assists - a.assists || b.goals - a.goals || b.minutes - a.minutes)
      .slice(0, 5),
  };
}

async function queryLeagueInsights(seasonId: number): Promise<LeagueInsights> {
  const [recentRows, nextRow, leaders, splitRows] = await Promise.all([
    prisma.match.findMany({
      where: { seasonId, status: 'FINISHED' },
      select: matchSelect,
      orderBy: { kickoffAt: 'desc' },
      take: 6,
    }),
    prisma.match.findFirst({
      where: {
        seasonId,
        status: 'SCHEDULED',
        kickoffAt: { gte: new Date() },
      },
      select: matchSelect,
      orderBy: { kickoffAt: 'asc' },
    }),
    playerLeaders(seasonId),
    splitPerformance(seasonId),
  ]);

  const splitByTeam = new Map<number, LeagueSplitRow>();
  for (const row of splitRows) {
    const current = splitByTeam.get(row.teamId) ?? {
      team: {
        id: row.teamId,
        name: row.teamName,
        slug: row.teamSlug,
        crestUrl: row.crestUrl,
      },
      home: { ...EMPTY_SPLIT },
      away: { ...EMPTY_SPLIT },
      totalPoints: 0,
    };
    if (row.isHome) current.home = normalizeSplit(row);
    else current.away = normalizeSplit(row);
    current.totalPoints = current.home.points + current.away.points;
    splitByTeam.set(row.teamId, current);
  }

  return {
    recentMatches: recentRows.map(serializeMatch),
    nextMatch: nextRow == null ? null : serializeMatch(nextRow),
    scorers: leaders
      .slice()
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.minutes - a.minutes)
      .slice(0, 5),
    assisters: leaders
      .slice()
      .sort((a, b) => b.assists - a.assists || b.goals - a.goals || b.minutes - a.minutes)
      .slice(0, 5),
    splitTable: Array.from(splitByTeam.values()).sort(
      (a, b) => b.totalPoints - a.totalPoints || a.team.name.localeCompare(b.team.name, 'es'),
    ),
  };
}

export function getTeamInsights(teamId: number, seasonId: number): Promise<TeamInsights> {
  return unstable_cache(
    () => queryTeamInsights(teamId, seasonId),
    ['team-insights-v1', String(teamId), String(seasonId)],
    {
      revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS,
      tags: [FOOTBALL_DATA_CACHE_TAG],
    },
  )();
}

export function getLeagueInsights(seasonId: number): Promise<LeagueInsights> {
  return unstable_cache(
    () => queryLeagueInsights(seasonId),
    ['league-insights-v1', String(seasonId)],
    {
      revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS,
      tags: [FOOTBALL_DATA_CACHE_TAG],
    },
  )();
}
