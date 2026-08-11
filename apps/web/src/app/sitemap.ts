import { prisma } from '@cornermaximo/db';
import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}`, changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE_URL}/partidos`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/jugadores`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/equipos`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/ligas`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/rankings`, changeFrequency: 'daily', priority: 0.85 },
    { url: `${BASE_URL}/comparador`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/scouting`, changeFrequency: 'daily', priority: 0.85 },
    { url: `${BASE_URL}/noticias`, changeFrequency: 'hourly', priority: 0.7 },
    { url: `${BASE_URL}/fichajes`, changeFrequency: 'hourly', priority: 0.7 },
    { url: `${BASE_URL}/mundial-2026`, changeFrequency: 'daily', priority: 0.85 },
    { url: `${BASE_URL}/mundial-2026/goleadores`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/sobre`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/metodologia`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/estado-datos`, changeFrequency: 'daily', priority: 0.4 },
  ];

  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [players, teams, leagues, matches] = await Promise.all([
      prisma.player.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.team.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.competition.findMany({ where: { type: 'LEAGUE' }, select: { slug: true, updatedAt: true } }),
      prisma.match.findMany({
        where: { kickoffAt: { gte: ninetyDaysAgo } },
        select: { id: true, updatedAt: true },
        orderBy: { kickoffAt: 'desc' },
        take: 5000,
      }),
    ]);

    return [
      ...staticRoutes,
      ...leagues.map((league) => ({
        url: `${BASE_URL}/ligas/${league.slug}`,
        lastModified: league.updatedAt,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })),
      ...teams.map((team) => ({
        url: `${BASE_URL}/equipos/${team.slug}`,
        lastModified: team.updatedAt,
        changeFrequency: 'daily' as const,
        priority: 0.75,
      })),
      ...players.map((player) => ({
        url: `${BASE_URL}/jugadores/${player.slug}`,
        lastModified: player.updatedAt,
        changeFrequency: 'daily' as const,
        priority: 0.85,
      })),
      ...matches.map((match) => ({
        url: `${BASE_URL}/partidos/${match.id}`,
        lastModified: match.updatedAt,
        changeFrequency: 'hourly' as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
