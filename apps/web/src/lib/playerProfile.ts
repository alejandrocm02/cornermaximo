import { prisma } from '@futstats/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG, FOOTBALL_DATA_REVALIDATE_SECONDS } from '@/lib/cache';

const PLAYER_CONTENT_REVALIDATE_SECONDS = 15 * 60;

export interface PlayerProfileCore {
  id: number;
  currentTeamId: number | null;
  slug: string;
  fullName: string;
  knownAs: string | null;
  photoUrl: string | null;
  birthDate: string | null;
  heightCm: number | null;
  shirtNumber: number | null;
  status: string;
  currentTeam: {
    name: string;
    slug: string;
    crestUrl: string | null;
  } | null;
  positions: Array<{
    group: string;
    isPrimary: boolean;
  }>;
  nationality: {
    name: string;
  } | null;
}

export interface PlayerProfileContent {
  news: Array<{
    id: number;
    title: string;
    url: string;
    source: string;
    publishedAt: string;
  }>;
  transfers: Array<{
    id: number;
    type: string;
    fee: string | null;
    date: string;
    fromName: string | null;
    toName: string | null;
  }>;
}

async function queryPlayerProfileCore(slug: string): Promise<PlayerProfileCore | null> {
  const player = await prisma.player.findUnique({
    where: { slug },
    select: {
      id: true,
      currentTeamId: true,
      slug: true,
      fullName: true,
      knownAs: true,
      photoUrl: true,
      birthDate: true,
      heightCm: true,
      shirtNumber: true,
      status: true,
      currentTeam: { select: { name: true, slug: true, crestUrl: true } },
      positions: { select: { group: true, isPrimary: true } },
      nationality: { select: { name: true } },
    },
  });

  if (player == null) return null;

  return {
    ...player,
    status: String(player.status),
    positions: player.positions.map((position) => ({
      group: String(position.group),
      isPrimary: position.isPrimary,
    })),
    birthDate: player.birthDate?.toISOString() ?? null,
  };
}

const cachedPlayerProfileCore = unstable_cache(queryPlayerProfileCore, ['player-profile-core'], {
  revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG],
});

export function getPlayerProfileCore(slug: string): Promise<PlayerProfileCore | null> {
  return cachedPlayerProfileCore(slug);
}

async function queryPlayerProfileContent(
  playerId: number,
  currentTeamId: number | null,
): Promise<PlayerProfileContent> {
  const [news, transfers] = await Promise.all([
    prisma.newsItem.findMany({
      where: {
        OR: [{ playerId }, ...(currentTeamId != null ? [{ teamId: currentTeamId }] : [])],
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: { id: true, title: true, url: true, source: true, publishedAt: true },
    }),
    prisma.transfer.findMany({
      where: { playerId },
      orderBy: { date: 'desc' },
      take: 3,
      select: { id: true, type: true, fee: true, date: true, fromName: true, toName: true },
    }),
  ]);

  return {
    news: news.map((item) => ({
      ...item,
      publishedAt: item.publishedAt.toISOString(),
    })),
    transfers: transfers.map((item) => ({
      ...item,
      date: item.date.toISOString(),
    })),
  };
}

const cachedPlayerProfileContent = unstable_cache(
  queryPlayerProfileContent,
  ['player-profile-content'],
  {
    revalidate: PLAYER_CONTENT_REVALIDATE_SECONDS,
    tags: [FOOTBALL_DATA_CACHE_TAG],
  },
);

export function getPlayerProfileContent(
  playerId: number,
  currentTeamId: number | null,
): Promise<PlayerProfileContent> {
  return cachedPlayerProfileContent(playerId, currentTeamId);
}
