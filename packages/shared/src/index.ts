/**
 * @futstats/shared — enums, constantes y tipos comunes a toda la plataforma.
 * Los enums replican los del schema de Prisma para no acoplar el frontend al cliente de BD.
 */

export const POSITION_GROUPS = ['GK', 'DF', 'MF', 'FW'] as const;
export type PositionGroup = (typeof POSITION_GROUPS)[number];

export const PLAYER_STATUSES = [
  'AVAILABLE',
  'INJURED',
  'SUSPENDED',
  'DOUBT',
  'NOT_CALLED',
] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

export const MATCH_STATUSES = [
  'SCHEDULED',
  'LIVE',
  'FINISHED',
  'POSTPONED',
  'SUSPENDED',
  'ABANDONED',
  'CANCELLED',
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_PLAYER_ROLES = [
  'STARTER',
  'SUBSTITUTE',
  'BENCH_UNUSED',
  'NOT_CALLED',
] as const;
export type MatchPlayerRole = (typeof MATCH_PLAYER_ROLES)[number];

export const PREFERRED_FEET = ['LEFT', 'RIGHT', 'BOTH'] as const;
export type PreferredFoot = (typeof PREFERRED_FEET)[number];

export type TrendDirection = 'UP' | 'STABLE' | 'DOWN' | 'INSUFFICIENT_SAMPLE';

export type TrackedCompetition = {
  slug: string;
  name: string;
  country: string;
  apiFootballId: number;
  type: 'LEAGUE' | 'CUP';
  seasons?: readonly number[];
};

/** Las 5 grandes ligas, con el id que usa API-Football. */
export const BIG_FIVE_LEAGUES: readonly TrackedCompetition[] = [
  { slug: 'laliga', name: 'LaLiga', country: 'Spain', apiFootballId: 140, type: 'LEAGUE' },
  { slug: 'premier-league', name: 'Premier League', country: 'England', apiFootballId: 39, type: 'LEAGUE' },
  { slug: 'serie-a', name: 'Serie A', country: 'Italy', apiFootballId: 135, type: 'LEAGUE' },
  { slug: 'bundesliga', name: 'Bundesliga', country: 'Germany', apiFootballId: 78, type: 'LEAGUE' },
  { slug: 'ligue-1', name: 'Ligue 1', country: 'France', apiFootballId: 61, type: 'LEAGUE' },
] as const;

/** FIFA World Cup 2026 en API-Football: league=1, season=2026. */
export const WORLD_CUP_2026: TrackedCompetition = {
  slug: 'mundial-2026',
  name: 'Mundial 2026',
  country: 'World',
  apiFootballId: 1,
  type: 'CUP',
  seasons: [2026],
} as const;

export const TRACKED_COMPETITIONS: readonly TrackedCompetition[] = [...BIG_FIVE_LEAGUES, WORLD_CUP_2026] as const;

export const RECENT_SEASON = 2025;
export const CURRENT_SEASON = 2026;
export const TRACKED_SEASONS = [RECENT_SEASON, CURRENT_SEASON] as const;

/** Número de partidos de la ventana de análisis reciente. */
export const RECENT_MATCHES_WINDOW = 5;

/** Minutos mínimos por ventana para calcular tendencias comparables. */
export const MIN_MINUTES_FOR_TREND = 180;

/** Convierte un nombre a slug URL-friendly (sin acentos, minúsculas, guiones). */
export function toSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
