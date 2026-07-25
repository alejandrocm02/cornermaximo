/**
 * Países y territorios futbolísticos del Modo Carrera.
 * - Códigos estables ISO 3166-1 alpha-2 (con códigos extendidos para las
 *   naciones británicas: GB-ENG, GB-SCT, GB-WLS, GB-NIR).
 * - La nacionalidad solo determina el contexto internacional (selección,
 *   confederación, torneos, narrativa): nunca el potencial ni la calidad
 *   inicial del futbolista.
 * - Las selecciones y torneos se simulan internamente: no usan datos reales
 *   de FutStats.
 */

export type Confederation = 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';

export interface FootballCountry {
  /** Código estable (ISO 3166-1 alpha-2, o GB-XXX para naciones británicas). */
  code: string;
  /** Nombre en español. */
  name: string;
  confederation: Confederation;
  /** Nivel futbolístico de la selección 1-5 (solo contexto internacional). */
  natLevel: 1 | 2 | 3 | 4 | 5;
}

export const FOOTBALL_COUNTRIES: FootballCountry[] = [
  // UEFA
  { code: 'ES', name: 'España', confederation: 'UEFA', natLevel: 5 },
  { code: 'GB-ENG', name: 'Inglaterra', confederation: 'UEFA', natLevel: 5 },
  { code: 'FR', name: 'Francia', confederation: 'UEFA', natLevel: 5 },
  { code: 'DE', name: 'Alemania', confederation: 'UEFA', natLevel: 5 },
  { code: 'IT', name: 'Italia', confederation: 'UEFA', natLevel: 4 },
  { code: 'PT', name: 'Portugal', confederation: 'UEFA', natLevel: 4 },
  { code: 'NL', name: 'Países Bajos', confederation: 'UEFA', natLevel: 4 },
  { code: 'BE', name: 'Bélgica', confederation: 'UEFA', natLevel: 4 },
  { code: 'HR', name: 'Croacia', confederation: 'UEFA', natLevel: 4 },
  { code: 'DK', name: 'Dinamarca', confederation: 'UEFA', natLevel: 3 },
  { code: 'CH', name: 'Suiza', confederation: 'UEFA', natLevel: 3 },
  { code: 'AT', name: 'Austria', confederation: 'UEFA', natLevel: 3 },
  { code: 'PL', name: 'Polonia', confederation: 'UEFA', natLevel: 3 },
  { code: 'UA', name: 'Ucrania', confederation: 'UEFA', natLevel: 3 },
  { code: 'RS', name: 'Serbia', confederation: 'UEFA', natLevel: 3 },
  { code: 'CZ', name: 'Chequia', confederation: 'UEFA', natLevel: 3 },
  { code: 'SE', name: 'Suecia', confederation: 'UEFA', natLevel: 3 },
  { code: 'NO', name: 'Noruega', confederation: 'UEFA', natLevel: 3 },
  { code: 'TR', name: 'Turquía', confederation: 'UEFA', natLevel: 3 },
  { code: 'GB-SCT', name: 'Escocia', confederation: 'UEFA', natLevel: 2 },
  { code: 'GB-WLS', name: 'Gales', confederation: 'UEFA', natLevel: 2 },
  { code: 'GB-NIR', name: 'Irlanda del Norte', confederation: 'UEFA', natLevel: 2 },
  { code: 'IE', name: 'Irlanda', confederation: 'UEFA', natLevel: 2 },
  { code: 'GR', name: 'Grecia', confederation: 'UEFA', natLevel: 2 },
  { code: 'HU', name: 'Hungría', confederation: 'UEFA', natLevel: 2 },
  { code: 'RO', name: 'Rumanía', confederation: 'UEFA', natLevel: 2 },
  { code: 'RU', name: 'Rusia', confederation: 'UEFA', natLevel: 2 },
  { code: 'SK', name: 'Eslovaquia', confederation: 'UEFA', natLevel: 2 },
  { code: 'SI', name: 'Eslovenia', confederation: 'UEFA', natLevel: 2 },
  { code: 'BA', name: 'Bosnia y Herzegovina', confederation: 'UEFA', natLevel: 2 },
  { code: 'AL', name: 'Albania', confederation: 'UEFA', natLevel: 2 },
  { code: 'MK', name: 'Macedonia del Norte', confederation: 'UEFA', natLevel: 1 },
  { code: 'ME', name: 'Montenegro', confederation: 'UEFA', natLevel: 1 },
  { code: 'GE', name: 'Georgia', confederation: 'UEFA', natLevel: 2 },
  { code: 'FI', name: 'Finlandia', confederation: 'UEFA', natLevel: 1 },
  { code: 'IS', name: 'Islandia', confederation: 'UEFA', natLevel: 1 },
  { code: 'BG', name: 'Bulgaria', confederation: 'UEFA', natLevel: 1 },
  { code: 'CY', name: 'Chipre', confederation: 'UEFA', natLevel: 1 },
  { code: 'IL', name: 'Israel', confederation: 'UEFA', natLevel: 1 },
  { code: 'LU', name: 'Luxemburgo', confederation: 'UEFA', natLevel: 1 },
  { code: 'AM', name: 'Armenia', confederation: 'UEFA', natLevel: 1 },
  { code: 'AZ', name: 'Azerbaiyán', confederation: 'UEFA', natLevel: 1 },
  { code: 'KZ', name: 'Kazajistán', confederation: 'UEFA', natLevel: 1 },
  { code: 'EE', name: 'Estonia', confederation: 'UEFA', natLevel: 1 },
  { code: 'LV', name: 'Letonia', confederation: 'UEFA', natLevel: 1 },
  { code: 'LT', name: 'Lituania', confederation: 'UEFA', natLevel: 1 },
  { code: 'MT', name: 'Malta', confederation: 'UEFA', natLevel: 1 },
  { code: 'AD', name: 'Andorra', confederation: 'UEFA', natLevel: 1 },
  // CONMEBOL
  { code: 'AR', name: 'Argentina', confederation: 'CONMEBOL', natLevel: 5 },
  { code: 'BR', name: 'Brasil', confederation: 'CONMEBOL', natLevel: 5 },
  { code: 'UY', name: 'Uruguay', confederation: 'CONMEBOL', natLevel: 4 },
  { code: 'CO', name: 'Colombia', confederation: 'CONMEBOL', natLevel: 3 },
  { code: 'CL', name: 'Chile', confederation: 'CONMEBOL', natLevel: 3 },
  { code: 'EC', name: 'Ecuador', confederation: 'CONMEBOL', natLevel: 3 },
  { code: 'PY', name: 'Paraguay', confederation: 'CONMEBOL', natLevel: 2 },
  { code: 'PE', name: 'Perú', confederation: 'CONMEBOL', natLevel: 2 },
  { code: 'VE', name: 'Venezuela', confederation: 'CONMEBOL', natLevel: 2 },
  { code: 'BO', name: 'Bolivia', confederation: 'CONMEBOL', natLevel: 1 },
  // CONCACAF
  { code: 'MX', name: 'México', confederation: 'CONCACAF', natLevel: 3 },
  { code: 'US', name: 'Estados Unidos', confederation: 'CONCACAF', natLevel: 3 },
  { code: 'CA', name: 'Canadá', confederation: 'CONCACAF', natLevel: 2 },
  { code: 'CR', name: 'Costa Rica', confederation: 'CONCACAF', natLevel: 2 },
  { code: 'PA', name: 'Panamá', confederation: 'CONCACAF', natLevel: 2 },
  { code: 'HN', name: 'Honduras', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'SV', name: 'El Salvador', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'GT', name: 'Guatemala', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'JM', name: 'Jamaica', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'TT', name: 'Trinidad y Tobago', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'HT', name: 'Haití', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'CU', name: 'Cuba', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'DO', name: 'República Dominicana', confederation: 'CONCACAF', natLevel: 1 },
  // CAF
  { code: 'MA', name: 'Marruecos', confederation: 'CAF', natLevel: 4 },
  { code: 'SN', name: 'Senegal', confederation: 'CAF', natLevel: 3 },
  { code: 'NG', name: 'Nigeria', confederation: 'CAF', natLevel: 3 },
  { code: 'EG', name: 'Egipto', confederation: 'CAF', natLevel: 3 },
  { code: 'DZ', name: 'Argelia', confederation: 'CAF', natLevel: 3 },
  { code: 'TN', name: 'Túnez', confederation: 'CAF', natLevel: 2 },
  { code: 'CM', name: 'Camerún', confederation: 'CAF', natLevel: 2 },
  { code: 'CI', name: 'Costa de Marfil', confederation: 'CAF', natLevel: 3 },
  { code: 'GH', name: 'Ghana', confederation: 'CAF', natLevel: 2 },
  { code: 'ML', name: 'Malí', confederation: 'CAF', natLevel: 2 },
  { code: 'CD', name: 'República Democrática del Congo', confederation: 'CAF', natLevel: 2 },
  { code: 'ZA', name: 'Sudáfrica', confederation: 'CAF', natLevel: 2 },
  { code: 'BF', name: 'Burkina Faso', confederation: 'CAF', natLevel: 1 },
  { code: 'GN', name: 'Guinea', confederation: 'CAF', natLevel: 1 },
  { code: 'GA', name: 'Gabón', confederation: 'CAF', natLevel: 1 },
  { code: 'CV', name: 'Cabo Verde', confederation: 'CAF', natLevel: 1 },
  { code: 'ZM', name: 'Zambia', confederation: 'CAF', natLevel: 1 },
  { code: 'KE', name: 'Kenia', confederation: 'CAF', natLevel: 1 },
  { code: 'AO', name: 'Angola', confederation: 'CAF', natLevel: 1 },
  { code: 'MZ', name: 'Mozambique', confederation: 'CAF', natLevel: 1 },
  { code: 'GQ', name: 'Guinea Ecuatorial', confederation: 'CAF', natLevel: 1 },
  // AFC
  { code: 'JP', name: 'Japón', confederation: 'AFC', natLevel: 3 },
  { code: 'KR', name: 'Corea del Sur', confederation: 'AFC', natLevel: 3 },
  { code: 'IR', name: 'Irán', confederation: 'AFC', natLevel: 2 },
  { code: 'SA', name: 'Arabia Saudí', confederation: 'AFC', natLevel: 2 },
  { code: 'AU', name: 'Australia', confederation: 'AFC', natLevel: 2 },
  { code: 'QA', name: 'Catar', confederation: 'AFC', natLevel: 2 },
  { code: 'UZ', name: 'Uzbekistán', confederation: 'AFC', natLevel: 1 },
  { code: 'IQ', name: 'Irak', confederation: 'AFC', natLevel: 1 },
  { code: 'AE', name: 'Emiratos Árabes Unidos', confederation: 'AFC', natLevel: 1 },
  { code: 'JO', name: 'Jordania', confederation: 'AFC', natLevel: 1 },
  { code: 'CN', name: 'China', confederation: 'AFC', natLevel: 1 },
  { code: 'TH', name: 'Tailandia', confederation: 'AFC', natLevel: 1 },
  { code: 'VN', name: 'Vietnam', confederation: 'AFC', natLevel: 1 },
  { code: 'IN', name: 'India', confederation: 'AFC', natLevel: 1 },
  { code: 'ID', name: 'Indonesia', confederation: 'AFC', natLevel: 1 },
  { code: 'MY', name: 'Malasia', confederation: 'AFC', natLevel: 1 },
  { code: 'PS', name: 'Palestina', confederation: 'AFC', natLevel: 1 },
  { code: 'SY', name: 'Siria', confederation: 'AFC', natLevel: 1 },
  // OFC
  { code: 'NZ', name: 'Nueva Zelanda', confederation: 'OFC', natLevel: 2 },
  { code: 'FJ', name: 'Fiyi', confederation: 'OFC', natLevel: 1 },
  { code: 'PG', name: 'Papúa Nueva Guinea', confederation: 'OFC', natLevel: 1 },
  { code: 'SB', name: 'Islas Salomón', confederation: 'OFC', natLevel: 1 },
  { code: 'NC', name: 'Nueva Caledonia', confederation: 'OFC', natLevel: 1 },
  { code: 'PF', name: 'Tahití (Polinesia Francesa)', confederation: 'OFC', natLevel: 1 },
];

/** Accesos rápidos mostrados antes de la lista completa. */
export const POPULAR_CODES = ['ES', 'AR', 'BR', 'FR', 'GB-ENG', 'DE', 'IT', 'PT', 'MX', 'US', 'MA', 'JP'];

const BY_CODE = new Map(FOOTBALL_COUNTRIES.map((c) => [c.code, c]));

export function countryByCode(code: string): FootballCountry | null {
  return BY_CODE.get(code) ?? null;
}

export function countryName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}

export function countryNatLevel(code: string): number {
  return BY_CODE.get(code)?.natLevel ?? 1;
}

export function confederationOf(code: string): Confederation {
  return BY_CODE.get(code)?.confederation ?? 'UEFA';
}

/** Banderas especiales para códigos sin emoji ISO directo. */
const SPECIAL_FLAGS: Record<string, string> = {
  'GB-ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'GB-SCT': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'GB-WLS': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'GB-NIR': '🇬🇧',
};

/** Emoji de bandera a partir del código (apoyo visual, nunca única señal). */
export function countryFlag(code: string): string {
  const special = SPECIAL_FLAGS[code];
  if (special != null) return special;
  const base = code.slice(0, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(base)) return '🏳️';
  const points = [...base].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65);
  return String.fromCodePoint(...points);
}

/** Normaliza texto para búsqueda: minúsculas y sin acentos. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Búsqueda tolerante a mayúsculas y acentos por nombre o código. */
export function searchCountries(query: string): FootballCountry[] {
  const q = normalizeText(query);
  if (q === '') return FOOTBALL_COUNTRIES;
  return FOOTBALL_COUNTRIES.filter(
    (c) => normalizeText(c.name).includes(q) || normalizeText(c.code).includes(q),
  );
}

/** Nombre del torneo continental simulado según confederación. */
export function continentalTournamentName(confederation: Confederation, year: number): string {
  const names: Record<Confederation, string> = {
    UEFA: 'Torneo Continental de Europa',
    CONMEBOL: 'Torneo Continental de Sudamérica',
    CONCACAF: 'Torneo Continental de Norteamérica',
    CAF: 'Torneo Continental de África',
    AFC: 'Torneo Continental de Asia',
    OFC: 'Torneo Continental de Oceanía',
  };
  return `${names[confederation]} ${year}`;
}
