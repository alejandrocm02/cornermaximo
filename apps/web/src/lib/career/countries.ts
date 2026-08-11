/**
 * Países y territorios futbolísticos del Modo Carrera.
 *
 * Cobertura: las 211 asociaciones miembro de la FIFA, agrupadas por
 * confederación. Cualquiera de ellas puede elegirse como selección nacional
 * sin restricciones — no hay lista corta ni países "bloqueados".
 *
 * - Códigos estables ISO 3166-1 alpha-2, con códigos extendidos para las
 *   naciones británicas (GB-ENG, GB-SCT, GB-WLS, GB-NIR) y XK para Kosovo.
 * - La nacionalidad solo determina el contexto internacional (selección,
 *   confederación, torneos, narrativa): nunca el potencial ni la calidad
 *   inicial del futbolista. Elegir una selección modesta cambia la historia,
 *   no la dificultad de progresar como jugador.
 * - `natLevel` (1-5) describe la competitividad histórica de la selección y
 *   solo se usa para simular resultados internacionales. El valor por defecto
 *   para asociaciones sin tradición reciente es 1.
 * - Las selecciones y torneos se simulan internamente: no usan datos reales
 *   de CornerMaximo.
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
  { code: 'BY', name: 'Bielorrusia', confederation: 'UEFA', natLevel: 1 },
  { code: 'MD', name: 'Moldavia', confederation: 'UEFA', natLevel: 1 },
  { code: 'XK', name: 'Kosovo', confederation: 'UEFA', natLevel: 1 },
  { code: 'FO', name: 'Islas Feroe', confederation: 'UEFA', natLevel: 1 },
  { code: 'GI', name: 'Gibraltar', confederation: 'UEFA', natLevel: 1 },
  { code: 'LI', name: 'Liechtenstein', confederation: 'UEFA', natLevel: 1 },
  { code: 'SM', name: 'San Marino', confederation: 'UEFA', natLevel: 1 },
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
  { code: 'NI', name: 'Nicaragua', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'SR', name: 'Surinam', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'GY', name: 'Guyana', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'CW', name: 'Curazao', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'PR', name: 'Puerto Rico', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'BB', name: 'Barbados', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'BS', name: 'Bahamas', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'BZ', name: 'Belice', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'BM', name: 'Bermudas', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'AW', name: 'Aruba', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'AG', name: 'Antigua y Barbuda', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'AI', name: 'Anguila', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'VG', name: 'Islas Vírgenes Británicas', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'VI', name: 'Islas Vírgenes de EE. UU.', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'KY', name: 'Islas Caimán', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'TC', name: 'Islas Turcas y Caicos', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'DM', name: 'Dominica', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'GD', name: 'Granada', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'KN', name: 'San Cristóbal y Nieves', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'LC', name: 'Santa Lucía', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'VC', name: 'San Vicente y las Granadinas', confederation: 'CONCACAF', natLevel: 1 },
  { code: 'MS', name: 'Montserrat', confederation: 'CONCACAF', natLevel: 1 },
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
  { code: 'UG', name: 'Uganda', confederation: 'CAF', natLevel: 1 },
  { code: 'TZ', name: 'Tanzania', confederation: 'CAF', natLevel: 1 },
  { code: 'ET', name: 'Etiopía', confederation: 'CAF', natLevel: 1 },
  { code: 'SD', name: 'Sudán', confederation: 'CAF', natLevel: 1 },
  { code: 'SS', name: 'Sudán del Sur', confederation: 'CAF', natLevel: 1 },
  { code: 'LY', name: 'Libia', confederation: 'CAF', natLevel: 1 },
  { code: 'BJ', name: 'Benín', confederation: 'CAF', natLevel: 1 },
  { code: 'TG', name: 'Togo', confederation: 'CAF', natLevel: 1 },
  { code: 'NE', name: 'Níger', confederation: 'CAF', natLevel: 1 },
  { code: 'GM', name: 'Gambia', confederation: 'CAF', natLevel: 1 },
  { code: 'GW', name: 'Guinea-Bisáu', confederation: 'CAF', natLevel: 1 },
  { code: 'SL', name: 'Sierra Leona', confederation: 'CAF', natLevel: 1 },
  { code: 'LR', name: 'Liberia', confederation: 'CAF', natLevel: 1 },
  { code: 'MR', name: 'Mauritania', confederation: 'CAF', natLevel: 1 },
  { code: 'CG', name: 'Congo', confederation: 'CAF', natLevel: 1 },
  { code: 'CF', name: 'República Centroafricana', confederation: 'CAF', natLevel: 1 },
  { code: 'TD', name: 'Chad', confederation: 'CAF', natLevel: 1 },
  { code: 'BI', name: 'Burundi', confederation: 'CAF', natLevel: 1 },
  { code: 'RW', name: 'Ruanda', confederation: 'CAF', natLevel: 1 },
  { code: 'KM', name: 'Comoras', confederation: 'CAF', natLevel: 1 },
  { code: 'DJ', name: 'Yibuti', confederation: 'CAF', natLevel: 1 },
  { code: 'ER', name: 'Eritrea', confederation: 'CAF', natLevel: 1 },
  { code: 'SO', name: 'Somalia', confederation: 'CAF', natLevel: 1 },
  { code: 'MG', name: 'Madagascar', confederation: 'CAF', natLevel: 1 },
  { code: 'MU', name: 'Mauricio', confederation: 'CAF', natLevel: 1 },
  { code: 'SC', name: 'Seychelles', confederation: 'CAF', natLevel: 1 },
  { code: 'MW', name: 'Malaui', confederation: 'CAF', natLevel: 1 },
  { code: 'ZW', name: 'Zimbabue', confederation: 'CAF', natLevel: 1 },
  { code: 'BW', name: 'Botsuana', confederation: 'CAF', natLevel: 1 },
  { code: 'NA', name: 'Namibia', confederation: 'CAF', natLevel: 1 },
  { code: 'LS', name: 'Lesoto', confederation: 'CAF', natLevel: 1 },
  { code: 'SZ', name: 'Esuatini', confederation: 'CAF', natLevel: 1 },
  { code: 'ST', name: 'Santo Tomé y Príncipe', confederation: 'CAF', natLevel: 1 },
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
  { code: 'KP', name: 'Corea del Norte', confederation: 'AFC', natLevel: 2 },
  { code: 'BH', name: 'Baréin', confederation: 'AFC', natLevel: 1 },
  { code: 'KW', name: 'Kuwait', confederation: 'AFC', natLevel: 1 },
  { code: 'OM', name: 'Omán', confederation: 'AFC', natLevel: 1 },
  { code: 'LB', name: 'Líbano', confederation: 'AFC', natLevel: 1 },
  { code: 'YE', name: 'Yemen', confederation: 'AFC', natLevel: 1 },
  { code: 'AF', name: 'Afganistán', confederation: 'AFC', natLevel: 1 },
  { code: 'PK', name: 'Pakistán', confederation: 'AFC', natLevel: 1 },
  { code: 'BD', name: 'Bangladés', confederation: 'AFC', natLevel: 1 },
  { code: 'NP', name: 'Nepal', confederation: 'AFC', natLevel: 1 },
  { code: 'BT', name: 'Bután', confederation: 'AFC', natLevel: 1 },
  { code: 'LK', name: 'Sri Lanka', confederation: 'AFC', natLevel: 1 },
  { code: 'MV', name: 'Maldivas', confederation: 'AFC', natLevel: 1 },
  { code: 'KG', name: 'Kirguistán', confederation: 'AFC', natLevel: 1 },
  { code: 'TJ', name: 'Tayikistán', confederation: 'AFC', natLevel: 1 },
  { code: 'TM', name: 'Turkmenistán', confederation: 'AFC', natLevel: 1 },
  { code: 'MN', name: 'Mongolia', confederation: 'AFC', natLevel: 1 },
  { code: 'HK', name: 'Hong Kong', confederation: 'AFC', natLevel: 1 },
  { code: 'MO', name: 'Macao', confederation: 'AFC', natLevel: 1 },
  { code: 'TW', name: 'Taipéi Chino', confederation: 'AFC', natLevel: 1 },
  { code: 'GU', name: 'Guam', confederation: 'AFC', natLevel: 1 },
  { code: 'PH', name: 'Filipinas', confederation: 'AFC', natLevel: 1 },
  { code: 'SG', name: 'Singapur', confederation: 'AFC', natLevel: 1 },
  { code: 'MM', name: 'Myanmar', confederation: 'AFC', natLevel: 1 },
  { code: 'KH', name: 'Camboya', confederation: 'AFC', natLevel: 1 },
  { code: 'LA', name: 'Laos', confederation: 'AFC', natLevel: 1 },
  { code: 'BN', name: 'Brunéi', confederation: 'AFC', natLevel: 1 },
  { code: 'TL', name: 'Timor Oriental', confederation: 'AFC', natLevel: 1 },
  // OFC
  { code: 'NZ', name: 'Nueva Zelanda', confederation: 'OFC', natLevel: 2 },
  { code: 'FJ', name: 'Fiyi', confederation: 'OFC', natLevel: 1 },
  { code: 'PG', name: 'Papúa Nueva Guinea', confederation: 'OFC', natLevel: 1 },
  { code: 'SB', name: 'Islas Salomón', confederation: 'OFC', natLevel: 1 },
  { code: 'NC', name: 'Nueva Caledonia', confederation: 'OFC', natLevel: 1 },
  { code: 'PF', name: 'Tahití (Polinesia Francesa)', confederation: 'OFC', natLevel: 1 },
  { code: 'VU', name: 'Vanuatu', confederation: 'OFC', natLevel: 1 },
  { code: 'WS', name: 'Samoa', confederation: 'OFC', natLevel: 1 },
  { code: 'AS', name: 'Samoa Americana', confederation: 'OFC', natLevel: 1 },
  { code: 'TO', name: 'Tonga', confederation: 'OFC', natLevel: 1 },
  { code: 'CK', name: 'Islas Cook', confederation: 'OFC', natLevel: 1 },
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

/** Nombre legible de cada confederación, para agrupar y buscar. */
export const CONFEDERATION_LABEL: Record<Confederation, string> = {
  UEFA: 'Europa (UEFA)',
  CONMEBOL: 'Sudamérica (CONMEBOL)',
  CONCACAF: 'Norteamérica y Caribe (CONCACAF)',
  CAF: 'África (CAF)',
  AFC: 'Asia (AFC)',
  OFC: 'Oceanía (OFC)',
};

/** Orden estable en el que se muestran las confederaciones. */
export const CONFEDERATION_ORDER: Confederation[] = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];

/**
 * Países agrupados por confederación y ordenados alfabéticamente dentro de
 * cada grupo. Con 211 asociaciones, una lista plana es inmanejable.
 */
export function countriesByConfederation(): Array<{ confederation: Confederation; countries: FootballCountry[] }> {
  return CONFEDERATION_ORDER.map((confederation) => ({
    confederation,
    countries: FOOTBALL_COUNTRIES.filter((c) => c.confederation === confederation).sort((a, b) =>
      a.name.localeCompare(b.name, 'es'),
    ),
  }));
}

/**
 * Búsqueda tolerante a mayúsculas y acentos por nombre, código o
 * confederación (así "africa" o "CAF" devuelven todo el continente).
 */
export function searchCountries(query: string): FootballCountry[] {
  const q = normalizeText(query);
  if (q === '') return FOOTBALL_COUNTRIES;
  return FOOTBALL_COUNTRIES.filter(
    (c) =>
      normalizeText(c.name).includes(q) ||
      normalizeText(c.code).includes(q) ||
      normalizeText(c.confederation).includes(q) ||
      normalizeText(CONFEDERATION_LABEL[c.confederation]).includes(q),
  ).sort((a, b) => {
    // Prioriza las coincidencias que empiezan por el término buscado.
    const aStarts = normalizeText(a.name).startsWith(q);
    const bStarts = normalizeText(b.name).startsWith(q);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    return a.name.localeCompare(b.name, 'es');
  });
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
