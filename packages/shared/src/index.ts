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

/** Las 5 grandes ligas, con el id que usa API-Football. */
export const BIG_FIVE_LEAGUES = [
  { slug: 'laliga', name: 'LaLiga', country: 'Spain', apiFootballId: 140 },
  { slug: 'premier-league', name: 'Premier League', country: 'England', apiFootballId: 39 },
  { slug: 'serie-a', name: 'Serie A', country: 'Italy', apiFootballId: 135 },
  { slug: 'bundesliga', name: 'Bundesliga', country: 'Germany', apiFootballId: 78 },
  { slug: 'ligue-1', name: 'Ligue 1', country: 'France', apiFootballId: 61 },
] as const;

/** Copa Mundial de la FIFA 2026 (Canadá/México/EE. UU.), id fijo de API-Football. */
export const WORLD_CUP_2026 = {
  slug: 'mundial-2026',
  name: 'Copa Mundial de la FIFA 2026',
  country: 'World',
  apiFootballId: 1,
} as const;

/** Temporadas (año de inicio) de las 5 grandes ligas que se mantienen sincronizadas. */
export const LEAGUE_SEASONS = [2025, 2026] as const; // 2025-26 (cierre) + 2026-27 (en curso)

/** Temporada más reciente: la que se marca isCurrent en cada liga. */
export const LATEST_LEAGUE_SEASON = LEAGUE_SEASONS[LEAGUE_SEASONS.length - 1];

/** Alias semánticos: última temporada de liga completada y la que está en curso. */
export const RECENT_SEASON = LEAGUE_SEASONS[0]; // 2025-26
export const CURRENT_SEASON = LEAGUE_SEASONS[1]; // 2026-27

/** Temporada (año) del Mundial 2026 en API-Football. */
export const WORLD_CUP_SEASON = 2026;

export type CompetitionKind = 'LEAGUE' | 'CUP';

export interface TrackedCompetition {
  slug: string;
  name: string;
  country: string;
  apiFootballId: number;
  type: CompetitionKind;
  /** Temporadas (año de inicio) a sincronizar para esta competición. */
  seasons: readonly number[];
}

/** Todas las competiciones que la plataforma sincroniza: 5 ligas + Mundial 2026. */
export const TRACKED_COMPETITIONS: readonly TrackedCompetition[] = [
  ...BIG_FIVE_LEAGUES.map((l) => ({
    slug: l.slug,
    name: l.name,
    country: l.country,
    apiFootballId: l.apiFootballId,
    type: 'LEAGUE' as const,
    seasons: LEAGUE_SEASONS,
  })),
  {
    slug: WORLD_CUP_2026.slug,
    name: WORLD_CUP_2026.name,
    country: WORLD_CUP_2026.country,
    apiFootballId: WORLD_CUP_2026.apiFootballId,
    type: 'CUP' as const,
    seasons: [WORLD_CUP_SEASON] as const,
  },
];

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
