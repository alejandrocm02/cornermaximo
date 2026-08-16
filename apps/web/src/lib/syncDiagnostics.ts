import { prisma } from '@cornermaximo/db';
import { getPublicDataHealth } from '@/lib/dataHealth';

function hoursSince(date: Date | null | undefined): number | null {
  if (date == null) return null;
  return Math.max(0, Math.round(((Date.now() - date.getTime()) / 3_600_000) * 10) / 10);
}

export async function getSyncDiagnostics() {
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const [
    failedJobs,
    recentLogs,
    budgetToday,
    lastSuccessByEntity,
    fieldFreshness,
    goalkeeperFreshness,
    injuriesOpen,
    playersByStatus,
    jobsByStatus,
    currentSeasons,
    publicHealth,
  ] = await Promise.all([
    prisma.syncJob.findMany({
      where: { status: 'FAILED' },
      orderBy: { finishedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        entity: true,
        entityExternalId: true,
        error: true,
        attempts: true,
        finishedAt: true,
        priority: true,
      },
    }),
    prisma.syncLog.findMany({
      where: { level: 'error' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, message: true, createdAt: true, syncJobId: true },
    }),
    prisma.requestBudget.findFirst({
      where: { date: todayUtc },
      select: { used: true, dailyLimit: true, date: true },
    }),
    prisma.syncJob.groupBy({
      by: ['entity'],
      where: { status: 'SUCCESS' },
      _max: { finishedAt: true },
    }),
    prisma.playerMatchStatistics.aggregate({ _max: { syncedAt: true } }),
    prisma.goalkeeperMatchStatistics.aggregate({ _max: { syncedAt: true } }),
    prisma.injury.count({ where: { resolvedAt: null } }),
    prisma.player.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.syncJob.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.season.findMany({
      where: { isCurrent: true },
      orderBy: [{ competitionId: 'asc' }, { year: 'desc' }],
      select: {
        id: true,
        competitionId: true,
        year: true,
        competition: { select: { name: true, slug: true } },
      },
    }),
    getPublicDataHealth(),
  ]);

  const [pendingResults, finishedWithoutStats, nextScheduled, runningJobs] = await Promise.all([
    prisma.match.count({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] },
        kickoffAt: { lt: now },
      },
    }),
    prisma.match.count({ where: { status: 'FINISHED', matchPlayers: { none: {} } } }),
    prisma.match.findFirst({
      where: { status: 'SCHEDULED', kickoffAt: { gte: now } },
      orderBy: { kickoffAt: 'asc' },
      select: {
        id: true,
        kickoffAt: true,
        externalId: true,
        season: { select: { competition: { select: { name: true } } } },
      },
    }),
    prisma.syncJob.findMany({
      where: { status: 'RUNNING' },
      orderBy: { startedAt: 'asc' },
      take: 20,
      select: {
        id: true,
        entity: true,
        entityExternalId: true,
        startedAt: true,
        attempts: true,
      },
    }),
  ]);

  const seasonsByCompetition = new Map<number, typeof currentSeasons>();
  for (const season of currentSeasons) {
    const list = seasonsByCompetition.get(season.competitionId) ?? [];
    list.push(season);
    seasonsByCompetition.set(season.competitionId, list);
  }
  const duplicateCurrentSeasons = [...seasonsByCompetition.values()].filter(
    (seasons) => seasons.length > 1,
  );

  const latestStatisticsDate = [
    fieldFreshness._max.syncedAt,
    goalkeeperFreshness._max.syncedAt,
  ]
    .filter((date): date is Date => date != null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    generatedAt: new Date().toISOString(),
    publicHealth,
    budgetToday: budgetToday ?? {
      used: 0,
      dailyLimit: null,
      date: todayUtc,
    },
    freshness: {
      latestStatisticsAt: latestStatisticsDate,
      hoursSinceLatestStatistics: hoursSince(latestStatisticsDate),
    },
    queue: {
      jobsByStatus,
      runningJobs,
      matchesPlayedWithoutResult: pendingResults,
      finishedMatchesWithoutStatistics: finishedWithoutStats,
      nextScheduled,
    },
    dataConsistency: {
      duplicateCurrentSeasons,
    },
    availability: {
      openInjuries: injuriesOpen,
      playersByStatus,
    },
    lastSuccessByEntity,
    failedJobs,
    recentErrors: recentLogs,
  };
}

export type SyncDiagnostics = Awaited<ReturnType<typeof getSyncDiagnostics>>;
