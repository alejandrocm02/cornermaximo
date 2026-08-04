import { prisma } from '@futstats/db';
import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/jugadores',
    '/ligas',
    '/rankings',
    '/comparador',
    '/noticias',
    '/fichajes',
    '/analizador',
    '/modo-carrera',
    '/mundial-2026',
    '/mundial-2026/goleadores',
    '/sobre',
    '/metodologia',
  ].map((path) => ({ url: `${BASE_URL}${path}`, changeFrequency: 'hourly' as const }));

  try {
    const [players, teams, leagues] = await Promise.all([
      prisma.player.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.team.findMany({ select: { slug: true, updatedAt: true } }),
      prisma.competition.findMany({ where: { type: 'LEAGUE' }, select: { slug: true, updatedAt: true } }),
    ]);
    return [
      ...staticRoutes,
      ...leagues.map((league) => ({ url: `${BASE_URL}/ligas/${league.slug}`, lastModified: league.updatedAt })),
      ...teams.map((team) => ({ url: `${BASE_URL}/equipos/${team.slug}`, lastModified: team.updatedAt })),
      ...players.map((player) => ({ url: `${BASE_URL}/jugadores/${player.slug}`, lastModified: player.updatedAt })),
    ];
  } catch {
    return staticRoutes;
  }
}
