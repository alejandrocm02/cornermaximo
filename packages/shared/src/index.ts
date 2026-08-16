/**
 * @cornermaximo/shared — enums, constantes y tipos comunes a toda la plataforma.
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

/**
 * Ligas europeas añadidas en la ampliación: dos segundas divisiones y tres
 * primeras. Todas de temporada partida, así que comparten `SPLIT_YEAR_SEASONS`.
 *
 * ⚠️ Verifica los ids con `npx tsx scripts/verify-league-ids.ts` antes de
 * desplegar: un id equivocado no falla, sincroniza otra competición entera.
 */
export const ADDITIONAL_LEAGUES = [
  { slug: 'laliga-2', name: 'Segunda División', country: 'Spain', apiFootballId: 141 },
  { slug: 'championship', name: 'Championship', country: 'England', apiFootballId: 40 },
  { slug: 'primeira-liga', name: 'Primeira Liga', country: 'Portugal', apiFootballId: 94 },
  { slug: 'eredivisie', name: 'Eredivisie', country: 'Netherlands', apiFootballId: 88 },
  { slug: 'super-lig', name: 'Süper Lig', country: 'Turkey', apiFootballId: 203 },
] as const;

/** Copa Mundial de la FIFA 2026 (Canadá/México/EE. UU.), id fijo de API-Football. */
export const WORLD_CUP_2026 = {
  slug: 'mundial-2026',
  name: 'Copa Mundial de la FIFA 2026',
  country: 'World',
  apiFootballId: 1,
} as const;

/**
 * Formato de temporada de una competición.
 *
 * - `SPLIT_YEAR`: la temporada cruza dos años naturales (agosto-mayo). El año
 *   almacenado es el de inicio, así que 2025 => "2025/26". Es el formato de las
 *   grandes ligas europeas y de las competiciones UEFA.
 * - `CALENDAR_YEAR`: la temporada cabe en un único año natural (marzo-noviembre,
 *   febrero-diciembre...). 2026 => "2026". Es el formato de las ligas nórdicas
 *   (Noruega, Suecia, Finlandia, Irlanda) y de casi toda América: MLS, Liga MX,
 *   Brasileirão, Argentina.
 *
 * API-Football usa el año de inicio en ambos casos, así que la diferencia es de
 * presentación y de resolución de "temporada actual", no de consulta.
 */
export const SEASON_FORMATS = ['SPLIT_YEAR', 'CALENDAR_YEAR'] as const;
export type SeasonFormat = (typeof SEASON_FORMATS)[number];

/**
 * Etiqueta legible de una temporada según el formato de su competición.
 * Es la única función que debe generar estas etiquetas: no derivar el año a mano.
 */
export function formatSeasonLabel(year: number, format: SeasonFormat): string {
  if (format === 'CALENDAR_YEAR') return String(year);
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}

/** Temporadas (año de inicio) de las competiciones europeas de temporada partida. */
export const SPLIT_YEAR_SEASONS = [2025, 2026] as const; // 2025-26 (cierre) + 2026-27 (en curso)

/** Temporadas de las competiciones de año natural que se sincronizan. */
export const CALENDAR_YEAR_SEASONS = [2026] as const;

/** Temporada (año) del Mundial 2026 en API-Football. */
export const WORLD_CUP_SEASON = 2026;

export type CompetitionKind = 'LEAGUE' | 'CUP';

export interface TrackedCompetition {
  slug: string;
  name: string;
  country: string;
  apiFootballId: number;
  type: CompetitionKind;
  /** Formato de temporada: determina la etiqueta y cuál es la temporada en curso. */
  seasonFormat: SeasonFormat;
  /** Temporadas (año de inicio) a sincronizar para esta competición. */
  seasons: readonly number[];
}

/**
 * Todas las competiciones que la plataforma sincroniza:
 * 5 grandes ligas + 5 ligas europeas adicionales + Mundial 2026.
 */
export const TRACKED_COMPETITIONS: readonly TrackedCompetition[] = [
  ...[...BIG_FIVE_LEAGUES, ...ADDITIONAL_LEAGUES].map((l) => ({
    slug: l.slug,
    name: l.name,
    country: l.country,
    apiFootballId: l.apiFootballId,
    type: 'LEAGUE' as const,
    seasonFormat: 'SPLIT_YEAR' as const,
    seasons: SPLIT_YEAR_SEASONS,
  })),
  {
    slug: WORLD_CUP_2026.slug,
    name: WORLD_CUP_2026.name,
    country: WORLD_CUP_2026.country,
    apiFootballId: WORLD_CUP_2026.apiFootballId,
    type: 'CUP' as const,
    seasonFormat: 'SPLIT_YEAR' as const,
    seasons: [WORLD_CUP_SEASON] as const,
  },
];

// ---------------------------------------------------------------------
// Resolución de temporada por competición
//
// Sustituye a las antiguas constantes globales RECENT_SEASON / CURRENT_SEASON,
// que asumían que todas las competiciones comparten calendario. En cuanto entra
// una liga de año natural esa suposición deja de ser cierta.
// ---------------------------------------------------------------------

const BY_SLUG = new Map(TRACKED_COMPETITIONS.map((c) => [c.slug, c]));

/** Competición rastreada por slug, o `null` si no está en la lista. */
export function trackedCompetition(slug: string): TrackedCompetition | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * Formato de temporada de una competición. Para competiciones que no están en la
 * lista rastreada se asume `SPLIT_YEAR`, que es el formato mayoritario en Europa.
 */
export function seasonFormatOf(slug: string): SeasonFormat {
  return BY_SLUG.get(slug)?.seasonFormat ?? 'SPLIT_YEAR';
}

/** Temporadas rastreadas de una competición, de más antigua a más reciente. */
export function seasonsOf(slug: string): readonly number[] {
  return BY_SLUG.get(slug)?.seasons ?? SPLIT_YEAR_SEASONS;
}

/** Temporada en curso de una competición: la más reciente de las rastreadas. */
export function currentSeasonOf(slug: string): number {
  const seasons = seasonsOf(slug);
  return seasons[seasons.length - 1]!;
}

/**
 * Temporada previa de una competición, o `null` si solo se rastrea una.
 * Es la que alimenta las vistas de "temporada recién cerrada".
 */
export function previousSeasonOf(slug: string): number | null {
  const seasons = seasonsOf(slug);
  return seasons.length > 1 ? seasons[seasons.length - 2]! : null;
}

/** Etiqueta de temporada resolviendo el formato a partir del slug de competición. */
export function seasonLabelOf(slug: string, year: number): string {
  return formatSeasonLabel(year, seasonFormatOf(slug));
}

/**
 * Temporadas de las 5 grandes ligas. Solo para textos que hablan explícitamente
 * de ellas (portada, metadatos). No usar como "la temporada" de la plataforma:
 * las ligas de año natural tienen la suya y no coinciden.
 */
export const BIG_FIVE_PREVIOUS_SEASON = SPLIT_YEAR_SEASONS[0];
export const BIG_FIVE_CURRENT_SEASON = SPLIT_YEAR_SEASONS[1];

/**
 * Unión ordenada de todas las temporadas rastreadas en cualquier competición.
 * Útil para selectores globales, como el de la página de rankings cuando no hay
 * ninguna liga concreta seleccionada.
 */
export const ALL_TRACKED_SEASONS: readonly number[] = [
  ...new Set(TRACKED_COMPETITIONS.flatMap((c) => [...c.seasons])),
].sort((a, b) => b - a);

// ---------------------------------------------------------------------
// Catálogo de ampliación (todavía NO se sincroniza)
//
// Para activar una competición basta con moverla a TRACKED_COMPETITIONS.
//
// ⚠️ Los `apiFootballId` de abajo deben verificarse contra el endpoint /leagues
// de tu cuenta antes de activarlos: un id equivocado sincroniza otra competición
// entera y ensucia la base de datos. Ver `scripts/verify-league-ids.ts`.
// ---------------------------------------------------------------------

export const EXPANSION_CANDIDATES: readonly TrackedCompetition[] = [
  // --- Europa, temporada partida ---
  { slug: 'pro-league', name: 'Jupiler Pro League', country: 'Belgium', apiFootballId: 144, type: 'LEAGUE', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },
  { slug: 'scottish-premiership', name: 'Scottish Premiership', country: 'Scotland', apiFootballId: 179, type: 'LEAGUE', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },
  { slug: 'austrian-bundesliga', name: 'Bundesliga (Austria)', country: 'Austria', apiFootballId: 218, type: 'LEAGUE', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },
  { slug: 'super-league-suiza', name: 'Super League', country: 'Switzerland', apiFootballId: 207, type: 'LEAGUE', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },
  { slug: 'superliga-danesa', name: 'Superliga', country: 'Denmark', apiFootballId: 119, type: 'LEAGUE', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },
  { slug: 'super-league-grecia', name: 'Super League', country: 'Greece', apiFootballId: 197, type: 'LEAGUE', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },
  { slug: 'ekstraklasa', name: 'Ekstraklasa', country: 'Poland', apiFootballId: 106, type: 'LEAGUE', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },
  { slug: 'fortuna-liga', name: 'Fortuna Liga', country: 'Czech-Republic', apiFootballId: 345, type: 'LEAGUE', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },
  { slug: 'hnl', name: 'HNL', country: 'Croatia', apiFootballId: 210, type: 'LEAGUE', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },
  { slug: 'superliga-serbia', name: 'Super Liga', country: 'Serbia', apiFootballId: 286, type: 'LEAGUE', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },

  // --- Europa, año natural: el caso que motiva este refactor ---
  { slug: 'eliteserien', name: 'Eliteserien', country: 'Norway', apiFootballId: 103, type: 'LEAGUE', seasonFormat: 'CALENDAR_YEAR', seasons: CALENDAR_YEAR_SEASONS },
  { slug: 'allsvenskan', name: 'Allsvenskan', country: 'Sweden', apiFootballId: 113, type: 'LEAGUE', seasonFormat: 'CALENDAR_YEAR', seasons: CALENDAR_YEAR_SEASONS },

  // --- Competiciones UEFA ---
  { slug: 'champions-league', name: 'UEFA Champions League', country: 'World', apiFootballId: 2, type: 'CUP', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },
  { slug: 'europa-league', name: 'UEFA Europa League', country: 'World', apiFootballId: 3, type: 'CUP', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },
  { slug: 'conference-league', name: 'UEFA Europa Conference League', country: 'World', apiFootballId: 848, type: 'CUP', seasonFormat: 'SPLIT_YEAR', seasons: SPLIT_YEAR_SEASONS },
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
