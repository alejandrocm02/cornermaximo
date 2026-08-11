import { prisma } from '@cornermaximo/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG } from '@/lib/cache';

const DATA_HEALTH_REVALIDATE_SECONDS = 15 * 60;

export type DataHealthLevel = 'OPERATIONAL' | 'DEGRADED' | 'ATTENTION' | 'UNKNOWN';
export type CompetitionCoverageLevel = 'COMPLETE' | 'READY' | 'PARTIAL' | 'PENDING' | 'REVIEW';

type CoverageRow = {
  seasonId: number;
  teamCount: number;
  standingRows: number;
  totalMatches: number;
  scheduledMatches: number;
  liveMatches: number;
  finishedMatches: number;
  pastDueMatches: number;
  finishedWithLineups: number;
  playerRows: number;
  statsRows: number;
  lastMatchUpdate: Date | null;
  lastStatsSync: Date | null;
};

export interface CompetitionCoverage {
  seasonId: number;
  year: number;
  competition: {
    name: string;
    slug: string;
    type: 'LEAGUE' | 'CUP';
    seasonFormat: 'SPLIT_YEAR' | 'CALENDAR_YEAR';
    logoUrl: string | null;
    externalId: string;
    country: string;
  };
  level: CompetitionCoverageLevel;
  teamCount: number;
  standingRows: number;
  totalMatches: number;
  scheduledMatches: number;
  liveMatches: number;
  finishedMatches: number;
  pastDueMatches: number;
  finishedWithoutLineups: number;
  lineupCoverage: number | null;
  statisticsCoverage: number | null;
  lastDataAt: string | null;
}

export interface PublicDataHealth {
  generatedAt: string;
  level: DataHealthLevel;
  lastSuccessfulSync: string | null;
  hoursSinceSuccessfulSync: number | null;
  totals: {
    competitions: number;
    teams: number;
    matches: number;
    scheduledMatches: number;
    liveMatches: number;
    finishedMatches: number;
    pastDueMatches: number;
    finishedWithoutLineups: number;
    completeCompetitions: number;
    competitionsNeedingReview: number;
  };
  competitions: CompetitionCoverage[];
}

function hoursSince(date: Date | null): number | null {
  if (date == null) return null;
  return Math.max(0, Math.round(((Date.now() - date.getTime()) / 3_600_000) * 10) / 10);
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.min(100, Math.round((numerator / denominator) * 100));
}

function newestIso(...dates: Array<Date | null | undefined>): string | null {
  const available = dates.filter((date): date is Date => date != null);
  if (available.length === 0) return null;
  return new Date(Math.max(...available.map((date) => date.getTime()))).toISOString();
}

function competitionCoverageLevel(input: {
  competitionType: 'LEAGUE' | 'CUP';
  teamCount: number;
  standingRows: number;
  totalMatches: number;
  finishedMatches: number;
  pastDueMatches: number;
  finishedWithoutLineups: number;
  statisticsCoverage: number | null;
}): CompetitionCoverageLevel {
  if (input.teamCount === 0 || input.totalMatches === 0) return 'PENDING';
  if (input.pastDueMatches > 0 || input.finishedWithoutLineups > 0) return 'REVIEW';
  if (input.finishedMatches === 0) return 'READY';

  const missingLeagueTable =
    input.competitionType === 'LEAGUE' && input.standingRows < input.teamCount;
  const incompleteStatistics =
    input.statisticsCoverage != null && input.statisticsCoverage < 80;

  if (missingLeagueTable || incompleteStatistics) return 'PARTIAL';
  return 'COMPLETE';
}

async function queryPublicDataHealth(): Promise<PublicDataHealth> {
  const [seasons, coverageRows, lastSuccessfulJob] = await Promise.all([
    prisma.season.findMany({
      where: { isCurrent: true },
      orderBy: [{ competition: { name: 'asc' } }, { year: 'desc' }],
      select: {
        id: true,
        year: true,
        competition: {
          select: {
            name: true,
            slug: true,
            type: true,
            seasonFormat: true,
            logoUrl: true,
            externalId: true,
            country: { select: { name: true } },
          },
        },
      },
    }),
    prisma.$queryRaw<CoverageRow[]>`
      WITH team_counts AS (
        SELECT "seasonId", COUNT(*)::int AS "teamCount"
        FROM "SeasonTeam"
        GROUP BY "seasonId"
      ),
      standing_counts AS (
        SELECT "seasonId", COUNT(*)::int AS "standingRows"
        FROM "Standing"
        GROUP BY "seasonId"
      ),
      match_counts AS (
        SELECT
          "seasonId",
          COUNT(*)::int AS "totalMatches",
          COUNT(*) FILTER (WHERE status = 'SCHEDULED')::int AS "scheduledMatches",
          COUNT(*) FILTER (WHERE status = 'LIVE')::int AS "liveMatches",
          COUNT(*) FILTER (WHERE status = 'FINISHED')::int AS "finishedMatches",
          COUNT(*) FILTER (
            WHERE status IN ('SCHEDULED', 'LIVE') AND "kickoffAt" < NOW()
          )::int AS "pastDueMatches",
          MAX("updatedAt") AS "lastMatchUpdate"
        FROM "Match"
        GROUP BY "seasonId"
      ),
      lineup_counts AS (
        SELECT
          m."seasonId",
          COUNT(mp.id)::int AS "playerRows",
          COUNT(DISTINCT mp."matchId") FILTER (WHERE m.status = 'FINISHED')::int AS "finishedWithLineups"
        FROM "Match" m
        LEFT JOIN "MatchPlayer" mp ON mp."matchId" = m.id
        GROUP BY m."seasonId"
      ),
      statistic_counts AS (
        SELECT
          m."seasonId",
          (COUNT(pms.id) + COUNT(gks.id))::int AS "statsRows",
          GREATEST(MAX(pms."syncedAt"), MAX(gks."syncedAt")) AS "lastStatsSync"
        FROM "Match" m
        LEFT JOIN "MatchPlayer" mp ON mp."matchId" = m.id
        LEFT JOIN "PlayerMatchStatistics" pms ON pms."matchPlayerId" = mp.id
        LEFT JOIN "GoalkeeperMatchStatistics" gks ON gks."matchPlayerId" = mp.id
        GROUP BY m."seasonId"
      )
      SELECT
        s.id AS "seasonId",
        COALESCE(tc."teamCount", 0)::int AS "teamCount",
        COALESCE(sc."standingRows", 0)::int AS "standingRows",
        COALESCE(mc."totalMatches", 0)::int AS "totalMatches",
        COALESCE(mc."scheduledMatches", 0)::int AS "scheduledMatches",
        COALESCE(mc."liveMatches", 0)::int AS "liveMatches",
        COALESCE(mc."finishedMatches", 0)::int AS "finishedMatches",
        COALESCE(mc."pastDueMatches", 0)::int AS "pastDueMatches",
        COALESCE(lc."finishedWithLineups", 0)::int AS "finishedWithLineups",
        COALESCE(lc."playerRows", 0)::int AS "playerRows",
        COALESCE(stc."statsRows", 0)::int AS "statsRows",
        mc."lastMatchUpdate" AS "lastMatchUpdate",
        stc."lastStatsSync" AS "lastStatsSync"
      FROM "Season" s
      LEFT JOIN team_counts tc ON tc."seasonId" = s.id
      LEFT JOIN standing_counts sc ON sc."seasonId" = s.id
      LEFT JOIN match_counts mc ON mc."seasonId" = s.id
      LEFT JOIN lineup_counts lc ON lc."seasonId" = s.id
      LEFT JOIN statistic_counts stc ON stc."seasonId" = s.id
      WHERE s."isCurrent" = true
    `,
    prisma.syncJob.aggregate({
      where: { status: 'SUCCESS' },
      _max: { finishedAt: true },
    }),
  ]);

  const rowsBySeason = new Map(coverageRows.map((row) => [row.seasonId, row]));

  const competitions = seasons.map<CompetitionCoverage>((season) => {
    const row = rowsBySeason.get(season.id) ?? {
      seasonId: season.id,
      teamCount: 0,
      standingRows: 0,
      totalMatches: 0,
      scheduledMatches: 0,
      liveMatches: 0,
      finishedMatches: 0,
      pastDueMatches: 0,
      finishedWithLineups: 0,
      playerRows: 0,
      statsRows: 0,
      lastMatchUpdate: null,
      lastStatsSync: null,
    };
    const finishedWithoutLineups = Math.max(
      0,
      row.finishedMatches - row.finishedWithLineups,
    );
    const lineupCoverage = percentage(row.finishedWithLineups, row.finishedMatches);
    const statisticsCoverage = percentage(row.statsRows, row.playerRows);
    const competitionType = String(season.competition.type) as 'LEAGUE' | 'CUP';

    return {
      seasonId: season.id,
      year: season.year,
      competition: {
        name: season.competition.name,
        slug: season.competition.slug,
        type: competitionType,
        seasonFormat: String(season.competition.seasonFormat) as
          | 'SPLIT_YEAR'
          | 'CALENDAR_YEAR',
        logoUrl: season.competition.logoUrl,
        externalId: season.competition.externalId,
        country: season.competition.country.name,
      },
      level: competitionCoverageLevel({
        competitionType,
        teamCount: row.teamCount,
        standingRows: row.standingRows,
        totalMatches: row.totalMatches,
        finishedMatches: row.finishedMatches,
        pastDueMatches: row.pastDueMatches,
        finishedWithoutLineups,
        statisticsCoverage,
      }),
      teamCount: row.teamCount,
      standingRows: row.standingRows,
      totalMatches: row.totalMatches,
      scheduledMatches: row.scheduledMatches,
      liveMatches: row.liveMatches,
      finishedMatches: row.finishedMatches,
      pastDueMatches: row.pastDueMatches,
      finishedWithoutLineups,
      lineupCoverage,
      statisticsCoverage,
      lastDataAt: newestIso(row.lastMatchUpdate, row.lastStatsSync),
    };
  });

  const totals = competitions.reduce(
    (result, competition) => ({
      competitions: result.competitions + 1,
      teams: result.teams + competition.teamCount,
      matches: result.matches + competition.totalMatches,
      scheduledMatches: result.scheduledMatches + competition.scheduledMatches,
      liveMatches: result.liveMatches + competition.liveMatches,
      finishedMatches: result.finishedMatches + competition.finishedMatches,
      pastDueMatches: result.pastDueMatches + competition.pastDueMatches,
      finishedWithoutLineups:
        result.finishedWithoutLineups + competition.finishedWithoutLineups,
      completeCompetitions:
        result.completeCompetitions + (competition.level === 'COMPLETE' ? 1 : 0),
      competitionsNeedingReview:
        result.competitionsNeedingReview + (competition.level === 'REVIEW' ? 1 : 0),
    }),
    {
      competitions: 0,
      teams: 0,
      matches: 0,
      scheduledMatches: 0,
      liveMatches: 0,
      finishedMatches: 0,
      pastDueMatches: 0,
      finishedWithoutLineups: 0,
      completeCompetitions: 0,
      competitionsNeedingReview: 0,
    },
  );

  const lastSuccessfulSync = lastSuccessfulJob._max.finishedAt;
  const freshnessHours = hoursSince(lastSuccessfulSync);
  let level: DataHealthLevel = 'UNKNOWN';

  if (freshnessHours != null) {
    if (
      freshnessHours <= 3 &&
      totals.pastDueMatches === 0 &&
      totals.competitionsNeedingReview === 0
    ) {
      level = 'OPERATIONAL';
    } else if (freshnessHours <= 8 && totals.pastDueMatches <= 2) {
      level = 'DEGRADED';
    } else {
      level = 'ATTENTION';
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    level,
    lastSuccessfulSync: lastSuccessfulSync?.toISOString() ?? null,
    hoursSinceSuccessfulSync: freshnessHours,
    totals,
    competitions,
  };
}

const cachedPublicDataHealth = unstable_cache(
  queryPublicDataHealth,
  ['public-data-health-v1'],
  {
    revalidate: DATA_HEALTH_REVALIDATE_SECONDS,
    tags: [FOOTBALL_DATA_CACHE_TAG],
  },
);

export function getPublicDataHealth(): Promise<PublicDataHealth> {
  return cachedPublicDataHealth();
}
