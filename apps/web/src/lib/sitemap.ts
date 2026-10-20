import { prisma } from '@cornermaximo/db';
import { UEFA_CLUB_COMPETITION_SLUGS } from '@cornermaximo/shared';

export type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export interface SitemapEntry {
  /** Ruta relativa al sitio, empezando por "/" (o "" para la portada). */
  path: string;
  lastModified?: Date | null;
  changeFrequency?: ChangeFrequency;
  priority?: number;
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: '', changeFrequency: 'hourly', priority: 1 },
  { path: '/partidos', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/jugadores', changeFrequency: 'daily', priority: 0.9 },
  { path: '/equipos', changeFrequency: 'daily', priority: 0.8 },
  { path: '/ligas', changeFrequency: 'daily', priority: 0.8 },
  { path: '/intelligence', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/pro', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/rankings', changeFrequency: 'daily', priority: 0.85 },
  { path: '/comparador', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/scouting', changeFrequency: 'daily', priority: 0.85 },
  { path: '/noticias', changeFrequency: 'hourly', priority: 0.7 },
  { path: '/fichajes', changeFrequency: 'hourly', priority: 0.7 },
  { path: '/mundial-2026', changeFrequency: 'daily', priority: 0.85 },
  { path: '/mundial-2026/goleadores', changeFrequency: 'daily', priority: 0.8 },
  { path: '/sobre', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/metodologia', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/estado-datos', changeFrequency: 'daily', priority: 0.4 },
];

/** Una hora en la CDN; después se sirve la copia anterior mientras se regenera. */
export const SITEMAP_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400';

/** Partidos más antiguos que esto no se listan: las fichas de jugador ya los enlazan. */
const MATCH_WINDOW_DAYS = 90;
const MATCH_LIMIT = 5000;

export async function getSitemapEntries(now: Date = new Date()): Promise<SitemapEntry[]> {
  const since = new Date(now.getTime() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [players, teams, leagues, matches] = await Promise.all([
    prisma.player.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.team.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.competition.findMany({
      where: { OR: [{ type: 'LEAGUE' }, { slug: { in: [...UEFA_CLUB_COMPETITION_SLUGS] } }] },
      select: { slug: true, updatedAt: true },
    }),
    prisma.match.findMany({
      where: { kickoffAt: { gte: since } },
      select: { id: true, updatedAt: true },
      orderBy: { kickoffAt: 'desc' },
      take: MATCH_LIMIT,
    }),
  ]);

  return [
    ...STATIC_ENTRIES,
    ...leagues.map((league) => ({
      path: `/ligas/${league.slug}`,
      lastModified: league.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...teams.map((team) => ({
      path: `/equipos/${team.slug}`,
      lastModified: team.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.75,
    })),
    ...players.map((player) => ({
      path: `/jugadores/${player.slug}`,
      lastModified: player.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.85,
    })),
    ...matches.map((match) => ({
      path: `/partidos/${match.id}`,
      lastModified: match.updatedAt,
      changeFrequency: 'hourly' as const,
      priority: 0.7,
    })),
  ];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderSitemapXml(baseUrl: string, entries: SitemapEntry[]): string {
  const base = baseUrl.replace(/\/$/, '');
  const urls = entries.map((entry) => {
    const parts = [`<loc>${escapeXml(`${base}${entry.path}`)}</loc>`];
    if (entry.lastModified && !Number.isNaN(entry.lastModified.getTime())) {
      parts.push(`<lastmod>${entry.lastModified.toISOString()}</lastmod>`);
    }
    if (entry.changeFrequency) parts.push(`<changefreq>${entry.changeFrequency}</changefreq>`);
    if (entry.priority != null) parts.push(`<priority>${entry.priority}</priority>`);
    return `<url>\n${parts.join('\n')}\n</url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
