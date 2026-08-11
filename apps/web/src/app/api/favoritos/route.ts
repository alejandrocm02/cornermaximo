import { prisma } from '@cornermaximo/db';
import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { FOOTBALL_DATA_CACHE_TAG } from '@/lib/cache';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PER_KIND = 20;
const FEED_REVALIDATE_SECONDS = 5 * 60;

function parseSlugs(url: URL, key: string): string[] {
  return [...new Set((url.searchParams.get(key) ?? '').split(',').map((value) => value.trim()))]
    .filter((value) => SLUG_PATTERN.test(value))
    .sort()
    .slice(0, MAX_PER_KIND);
}

async function queryFavoriteFeed(
  playerSlugs: string[],
  teamSlugs: string[],
  competitionSlugs: string[],
) {
  const [players, teams, competitions] = await Promise.all([
    playerSlugs.length === 0
      ? []
      : prisma.player.findMany({
          where: { slug: { in: playerSlugs } },
          select: {
            slug: true,
            fullName: true,
            knownAs: true,
            photoUrl: true,
            currentTeam: { select: { name: true, slug: true } },
          },
        }),
    teamSlugs.length === 0
      ? []
      : prisma.team.findMany({
          where: { slug: { in: teamSlugs } },
          select: {
            slug: true,
            name: true,
            crestUrl: true,
            isNational: true,
            country: { select: { name: true } },
          },
        }),
    competitionSlugs.length === 0
      ? []
      : prisma.competition.findMany({
          where: { slug: { in: competitionSlugs } },
          select: {
            slug: true,
            name: true,
            logoUrl: true,
            externalId: true,
            country: { select: { name: true } },
          },
        }),
  ]);

  const relatedTeamSlugs = [
    ...new Set([
      ...teamSlugs,
      ...players.flatMap((player) =>
        player.currentTeam == null ? [] : [player.currentTeam.slug],
      ),
    ]),
  ];
  const matchFilters = [
    ...(relatedTeamSlugs.length > 0
      ? [{ teams: { some: { team: { slug: { in: relatedTeamSlugs } } } } }]
      : []),
    ...(competitionSlugs.length > 0
      ? [{ season: { competition: { slug: { in: competitionSlugs } } } }]
      : []),
  ];

  const matches =
    matchFilters.length === 0
      ? []
      : await prisma.match.findMany({
          where: {
            status: 'SCHEDULED',
            kickoffAt: { gte: new Date() },
            OR: matchFilters,
          },
          orderBy: { kickoffAt: 'asc' },
          take: 12,
          select: {
            id: true,
            kickoffAt: true,
            round: true,
            season: {
              select: {
                competition: {
                  select: { name: true, slug: true, type: true },
                },
              },
            },
            teams: {
              select: {
                isHome: true,
                team: { select: { name: true, slug: true, crestUrl: true } },
              },
            },
          },
        });

  return {
    generatedAt: new Date().toISOString(),
    players: players.map((player) => ({
      kind: 'player' as const,
      slug: player.slug,
      name: player.knownAs ?? player.fullName,
      imageUrl: player.photoUrl,
      subtitle: player.currentTeam?.name ?? null,
      href: `/jugadores/${player.slug}`,
    })),
    teams: teams.map((team) => ({
      kind: 'team' as const,
      slug: team.slug,
      name: team.name,
      imageUrl: team.crestUrl,
      subtitle: team.isNational ? `Selección de ${team.country.name}` : team.country.name,
      href: `/equipos/${team.slug}`,
    })),
    competitions: competitions.map((competition) => ({
      kind: 'competition' as const,
      slug: competition.slug,
      name: competition.name,
      imageUrl:
        competition.logoUrl ??
        `https://media.api-sports.io/football/leagues/${competition.externalId}.png`,
      subtitle: competition.country.name,
      href: `/ligas/${competition.slug}`,
    })),
    upcomingMatches: matches.map((match) => ({
      id: match.id,
      kickoffAt: match.kickoffAt.toISOString(),
      round: match.round,
      competition: match.season.competition,
      home: match.teams.find((team) => team.isHome)?.team ?? null,
      away: match.teams.find((team) => !team.isHome)?.team ?? null,
    })),
  };
}

const cachedFavoriteFeed = unstable_cache(queryFavoriteFeed, ['favorite-feed-v1'], {
  revalidate: FEED_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG],
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const playerSlugs = parseSlugs(url, 'players');
  const teamSlugs = parseSlugs(url, 'teams');
  const competitionSlugs = parseSlugs(url, 'competitions');

  const result = await cachedFavoriteFeed(playerSlugs, teamSlugs, competitionSlugs);
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  });
}
