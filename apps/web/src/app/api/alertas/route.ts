import { prisma } from '@cornermaximo/db';
import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { FOOTBALL_DATA_CACHE_TAG } from '@/lib/cache';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX = 20;

function values(url: URL, key: string): string[] {
  return [...new Set((url.searchParams.get(key) ?? '').split(',').map((item) => item.trim()))]
    .filter((item) => SLUG.test(item))
    .slice(0, MAX)
    .sort();
}

async function queryAlerts(players: string[], teams: string[], competitions: string[]) {
  const favoritePlayers = players.length === 0 ? [] : await prisma.player.findMany({
    where: { slug: { in: players } },
    select: { currentTeam: { select: { slug: true } } },
  });
  const relatedTeams = [...new Set([...teams, ...favoritePlayers.flatMap((player) => player.currentTeam == null ? [] : [player.currentTeam.slug])])];
  const filters = [
    ...(relatedTeams.length > 0 ? [{ teams: { some: { team: { slug: { in: relatedTeams } } } } }] : []),
    ...(competitions.length > 0 ? [{ season: { competition: { slug: { in: competitions } } } }] : []),
  ];
  if (filters.length === 0) return { generatedAt: new Date().toISOString(), alerts: [] };

  const now = new Date();
  const matches = await prisma.match.findMany({
    where: {
      OR: filters,
      kickoffAt: { gte: new Date(now.getTime() - 7 * 86400000), lte: new Date(now.getTime() + 14 * 86400000) },
      status: { in: ['SCHEDULED', 'LIVE', 'FINISHED'] },
      season: { isCurrent: true },
    },
    orderBy: { kickoffAt: 'desc' },
    take: 40,
    select: {
      id: true,
      kickoffAt: true,
      status: true,
      round: true,
      season: { select: { competition: { select: { name: true, slug: true } } } },
      teams: { select: { isHome: true, goals: true, team: { select: { name: true, slug: true, crestUrl: true } } } },
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    alerts: matches.map((match) => {
      const home = match.teams.find((entry) => entry.isHome) ?? null;
      const away = match.teams.find((entry) => !entry.isHome) ?? null;
      const type = match.status === 'FINISHED' ? 'RESULT' : match.status === 'LIVE' ? 'LIVE' : 'UPCOMING';
      return {
        id: `${type.toLowerCase()}-${match.id}`,
        type,
        matchId: match.id,
        kickoffAt: match.kickoffAt.toISOString(),
        status: String(match.status),
        round: match.round,
        competition: match.season.competition,
        home: home == null ? null : { ...home.team, goals: home.goals },
        away: away == null ? null : { ...away.team, goals: away.goals },
      };
    }),
  };
}

const cached = unstable_cache(queryAlerts, ['favorite-alerts-v1'], {
  revalidate: 5 * 60,
  tags: [FOOTBALL_DATA_CACHE_TAG, 'matches'],
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await cached(values(url, 'players'), values(url, 'teams'), values(url, 'competitions'));
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
