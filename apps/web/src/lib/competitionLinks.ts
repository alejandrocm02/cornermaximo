import { UEFA_CLUB_COMPETITION_SLUGS, WORLD_CUP_2026 } from '@cornermaximo/shared';

/** ¿Es una competición UEFA de clubes (Champions, Europa o Conference League)? */
export function isUefaClubCompetition(slug: string): boolean {
  return UEFA_CLUB_COMPETITION_SLUGS.includes(slug);
}

/**
 * Página pública de una competición, o `null` si no tiene una propia.
 * Ligas y copas UEFA viven en /ligas/<slug>; el Mundial tiene su sección.
 */
export function competitionHref(competition: { slug: string; type: string }): string | null {
  if (competition.slug === WORLD_CUP_2026.slug) return '/mundial-2026';
  if (competition.type === 'LEAGUE' || isUefaClubCompetition(competition.slug)) return `/ligas/${competition.slug}`;
  return null;
}
