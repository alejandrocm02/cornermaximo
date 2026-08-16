import { prisma } from '@cornermaximo/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG, FOOTBALL_DATA_REVALIDATE_SECONDS } from '@/lib/cache';

async function queryFavoriteTeam(slug: string) {
  return prisma.team.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      crestUrl: true,
      isNational: true,
      country: { select: { name: true } },
    },
  });
}

const cachedFavoriteTeam = unstable_cache(queryFavoriteTeam, ['favorite-team-identity'], {
  revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG],
});

export function getFavoriteTeamIdentity(slug: string) {
  return cachedFavoriteTeam(slug);
}

async function queryFavoriteCompetition(slug: string) {
  return prisma.competition.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      externalId: true,
      country: { select: { name: true } },
    },
  });
}

const cachedFavoriteCompetition = unstable_cache(
  queryFavoriteCompetition,
  ['favorite-competition-identity'],
  {
    revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS,
    tags: [FOOTBALL_DATA_CACHE_TAG],
  },
);

export function getFavoriteCompetitionIdentity(slug: string) {
  return cachedFavoriteCompetition(slug);
}
