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
    '/apuestas',
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
      ...leagues.map((l) => ({ url: `${BASE_URL}/ligas/${l.slug}`, lastModified: l.updatedAt })),
      ...teams.map((t) => ({ url: `${BASE_URL}/equipos/${t.slug}`, lastModified: t.updatedAt })),
      ...players.map((p) => ({ url: `${BASE_URL}/jugadores/${p.slug}`, lastModified: p.updatedAt })),
    ];
  } catch {
    return staticRoutes; // sin BD (build local): solo rutas estáticas
  }
}
