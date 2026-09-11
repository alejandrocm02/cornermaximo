import 'server-only';

import { prisma } from '@cornermaximo/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG, FOOTBALL_DATA_REVALIDATE_SECONDS } from '@/lib/cache';
import { seasonLabel } from '@/lib/football';
import type { HistoryFilters, HistoryMatch } from '@/lib/matchHistory';

async function queryHistoryOptions(playerId: number) {
  const seasons = await prisma.season.findMany({
    where: { matches: { some: { status: 'FINISHED', matchPlayers: { some: { playerId } } } } },
    select: { year: true, competition: { select: { id: true, name: true, seasonFormat: true } } },
    orderBy: [{ year: 'desc' }, { competition: { name: 'asc' } }],
  });
  const competitions = new Map<number, { id: number; name: string }>();
  const years = new Map<number, Set<string>>();
  for (const season of seasons) {
    competitions.set(season.competition.id, { id: season.competition.id, name: season.competition.name });
    const labels = years.get(season.year) ?? new Set<string>();
    labels.add(seasonLabel(season.year, season.competition.seasonFormat));
    years.set(season.year, labels);
  }
  return {
    competitions: [...competitions.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    years: [...years].map(([year, labels]) => ({ year, label: [...labels].join(' · ') })),
  };
}

async function queryPlayerMatchHistory(playerId: number, filters: HistoryFilters): Promise<HistoryMatch[]> {
  // Venue belongs to the team represented in THAT match, including past transfers.
  // Correlate both matchId and teamId before LIMIT, rather than filtering a window
  // afterwards or using the player's current team. Tagged SQL binds every value.
  const ids = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT mp.id
    FROM "MatchPlayer" mp
    JOIN "Match" m ON m.id = mp."matchId"
    JOIN "Season" s ON s.id = m."seasonId"
    JOIN "MatchTeam" mt ON mt."matchId" = mp."matchId" AND mt."teamId" = mp."teamId"
    WHERE mp."playerId" = ${playerId} AND m.status = 'FINISHED'
      AND (${filters.year}::int IS NULL OR s.year = ${filters.year})
      AND (${filters.competitionId}::int IS NULL OR s."competitionId" = ${filters.competitionId})
      AND (${filters.venue} = 'all' OR mt."isHome" = ${filters.venue === 'home'})
    ORDER BY m."kickoffAt" DESC, m.id DESC
    LIMIT ${filters.count}
  `;
  if (!ids.length) return [];
  const rows = await prisma.matchPlayer.findMany({
    where: { id: { in: ids.map((row) => row.id) } },
    include: {
      fieldStats: true,
      gkStats: true,
      match: { include: {
        season: { include: { competition: true } },
        teams: { include: { team: { select: { id: true, name: true, crestUrl: true } } } },
      } },
    },
    orderBy: [{ match: { kickoffAt: 'desc' } }, { matchId: 'desc' }],
    take: filters.count,
  });
  return rows.map((row) => {
    const home = row.match.teams.find((team) => team.isHome);
    const away = row.match.teams.find((team) => !team.isHome);
    const field = row.fieldStats;
    return {
      id: row.matchId,
      date: row.match.kickoffAt.toISOString(),
      competition: row.match.season.competition.name,
      season: seasonLabel(row.match.season.year, row.match.season.competition.seasonFormat),
      round: row.match.round,
      isHome: home?.teamId === row.teamId,
      home: { name: home?.team.name ?? 'Local', crestUrl: home?.team.crestUrl ?? null, goals: home?.goals ?? null },
      away: { name: away?.team.name ?? 'Visitante', crestUrl: away?.team.crestUrl ?? null, goals: away?.goals ?? null },
      minutes: row.minutesPlayed,
      role: row.role,
      position: row.positionPlayed,
      rating: row.rating,
      stats: {
        goals: field?.goals ?? null,
        assists: field?.assists ?? null,
        shotsTotal: field?.shotsTotal ?? null,
        shotsOnTarget: field?.shotsOnTarget ?? null,
        passesAttempted: field?.passesAttempted ?? null,
        passesCompleted: field?.passesCompleted ?? null,
        keyPasses: field?.keyPasses ?? null,
        tackles: field?.tacklesAttempted ?? null,
        interceptions: field?.interceptions ?? null,
        duelsWon: field?.duelsWon ?? null,
        foulsCommitted: field?.foulsCommitted ?? null,
        foulsDrawn: field?.foulsDrawn ?? null,
        yellowCards: field?.yellowCards ?? null,
        redCards: field?.redCards ?? null,
        saves: row.gkStats?.saves ?? null,
        goalsConceded: row.gkStats?.goalsConceded ?? null,
        penaltiesSaved: row.gkStats?.penaltiesSaved ?? null,
      },
    };
  });
}

export const getHistoryOptions = unstable_cache(queryHistoryOptions, ['player-history-options'], {
  revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG],
});

export const getPlayerMatchHistory = unstable_cache(queryPlayerMatchHistory, ['player-match-history'], {
  revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG],
});
