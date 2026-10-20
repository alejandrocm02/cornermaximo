/**
 * Datos de la portada que no son del directo, cacheados.
 *
 * La portada es la página más visitada y hacía siete consultas a la base de
 * datos en cada visita. Recuento de jugadores, próximos partidos, últimos
 * resultados y noticias solo cambian cuando sincroniza el cron o cuando el
 * directo actualiza un partido, y ambos invalidan estas etiquetas. Los
 * partidos en juego se siguen leyendo sin caché en la propia página.
 */
import { prisma } from '@cornermaximo/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG, MATCHES_CACHE_TAG } from '@/lib/cache';
import { newsSourceFilter } from '@/lib/newsLanguage';

/** Red de seguridad si ninguna invalidación llega: el contenido no se queda viejo más de 5 min. */
const HOME_REVALIDATE_SECONDS = 5 * 60;

export const HOME_MATCH_SELECT = {
  id: true,
  kickoffAt: true,
  status: true,
  round: true,
  teams: { select: { isHome: true, goals: true, penaltyGoals: true, team: { select: { name: true, slug: true } } } },
  season: { select: { year: true, competition: { select: { name: true, slug: true } } } },
} as const;

async function queryHomeSnapshot() {
  const now = new Date();
  const [playersCount, upcomingMatches, recentMatches, latestNews] = await Promise.all([
    prisma.player.count(),
    prisma.match.findMany({
      where: { status: 'SCHEDULED', kickoffAt: { gte: now }, season: { isCurrent: true } },
      select: HOME_MATCH_SELECT,
      orderBy: { kickoffAt: 'asc' },
      take: 6,
    }),
    prisma.match.findMany({
      where: { status: 'FINISHED', season: { isCurrent: true } },
      select: HOME_MATCH_SELECT,
      orderBy: { kickoffAt: 'desc' },
      take: 6,
    }),
    prisma.newsItem.findMany({
      // La portada es en español; los titulares en inglés siguen en /noticias.
      where: { source: newsSourceFilter('es') },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: { id: true, title: true, url: true, source: true },
    }),
  ]);
  return { playersCount, upcomingMatches, recentMatches, latestNews };
}

const cachedHomeSnapshot = unstable_cache(queryHomeSnapshot, ['home-snapshot-v1'], {
  revalidate: HOME_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG, MATCHES_CACHE_TAG],
});

/** La caché de datos guarda JSON: las fechas vuelven como texto y se restauran aquí. */
function reviveKickoff<T extends { kickoffAt: Date }>(match: T): T {
  return { ...match, kickoffAt: new Date(match.kickoffAt) };
}

export async function getHomeSnapshot() {
  const snapshot = await cachedHomeSnapshot();
  return {
    ...snapshot,
    upcomingMatches: snapshot.upcomingMatches.map(reviveKickoff),
    recentMatches: snapshot.recentMatches.map(reviveKickoff),
  };
}
