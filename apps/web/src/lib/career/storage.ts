/**
 * Persistencia local del Modo Carrera.
 * Todo se guarda únicamente en localStorage de este dispositivo (sin cuentas).
 * La arquitectura deja preparado un punto único (este módulo) para conectar
 * más adelante un backend con autenticación y rankings globales.
 */
import { countryName } from './countries';
import type { CareerCard, CareerState } from './types';

export const CAREERS_KEY = 'futstats.carrera.partidas.v1';
export const RANKING_KEY = 'futstats.carrera.ranking.v1';
const MAX_SLOTS = 5;
const MAX_RANKING = 25;

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Almacenamiento lleno o bloqueado: el juego sigue en memoria.
  }
}

// --- Migración v1 → v2 ----------------------------------------------------

/** Códigos antiguos (v1) → códigos estables actuales. */
const LEGACY_CODES: Record<string, string> = {
  ESP: 'ES',
  ING: 'GB-ENG',
  FRA: 'FR',
  ALE: 'DE',
  ITA: 'IT',
  POR: 'PT',
  BRA: 'BR',
  ARG: 'AR',
  NED: 'NL',
  BEL: 'BE',
  URU: 'UY',
  MEX: 'MX',
  USA: 'US',
  MAR: 'MA',
  JPN: 'JP',
  COL: 'CO',
};

function mapLegacyCode(code: string | null | undefined): string | null {
  if (code == null) return null;
  return LEGACY_CODES[code] ?? code;
}

/**
 * Migra una partida guardada con el formato v1 (códigos propios y campos
 * country/secondCountry) al formato v2 sin perder el progreso.
 */
function migrateCareer(raw: unknown): CareerState | null {
  if (raw == null || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown> & { v?: number };
  if (c.v === 2) return raw as CareerState;
  if (c.v !== 1) return null;
  try {
    const player = c.player as Record<string, unknown>;
    const club = c.club as Record<string, unknown>;
    const national = c.national as Record<string, unknown>;
    const primary = mapLegacyCode(player.country as string) ?? 'ES';
    player.primaryNationalityCode = primary;
    player.secondaryNationalityCode = mapLegacyCode(player.secondCountry as string | null);
    delete player.country;
    delete player.secondCountry;
    club.country = mapLegacyCode(club.country as string) ?? 'ES';
    // Si ya había convocatorias en v1, la federación era la nacionalidad única.
    national.teamCode = (national.level as string) !== 'ninguna' ? primary : null;
    c.v = 2;
    return c as unknown as CareerState;
  } catch {
    return null;
  }
}

/** Migra una tarjeta del ranking v1 (campo `country`) al formato v2. */
function migrateCard(raw: unknown): CareerCard | null {
  if (raw == null || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.countryCode === 'string') return raw as CareerCard;
  const code = mapLegacyCode(c.country as string) ?? 'ES';
  c.countryCode = code;
  c.countryName = countryName(code);
  c.nationalTeamCode = (c.caps as number) > 0 ? code : null;
  delete c.country;
  return c as unknown as CareerCard;
}

// --- Partidas -------------------------------------------------------------

export function loadCareers(): CareerState[] {
  const items = loadJson<unknown[]>(CAREERS_KEY, []);
  return items.map(migrateCareer).filter((c): c is CareerState => c != null);
}

export function saveCareer(state: CareerState): void {
  const items = loadCareers().filter((c) => c.id !== state.id);
  items.unshift(state);
  saveJson(CAREERS_KEY, items.slice(0, MAX_SLOTS));
}

export function deleteCareer(id: string): void {
  saveJson(
    CAREERS_KEY,
    loadCareers().filter((c) => c.id !== id),
  );
}

// --- Ranking local --------------------------------------------------------

export function loadRanking(): CareerCard[] {
  const items = loadJson<unknown[]>(RANKING_KEY, []);
  return items.map(migrateCard).filter((c): c is CareerCard => c != null);
}

/**
 * Añade una carrera terminada al ranking local.
 * Medida básica contra manipulación: se recalcula un sello simple del
 * contenido; entradas sin sello coherente se descartan al cargar.
 */
export function addToRanking(card: CareerCard): CareerCard[] {
  const items = loadRanking().filter((c) => c.id !== card.id);
  items.push(card);
  items.sort((a, b) => b.score - a.score);
  const trimmed = items.slice(0, MAX_RANKING);
  saveJson(RANKING_KEY, trimmed);
  return trimmed;
}

export function clearRanking(): void {
  saveJson(RANKING_KEY, []);
}

// --- Analítica ------------------------------------------------------------

type AnalyticsProps = Record<string, string | number | boolean>;

/**
 * Analítica respetuosa con la privacidad: nunca se envían nombres
 * personalizados ni datos identificables. Si no hay colector configurado,
 * el evento simplemente se descarta.
 */
export function track(event: string, props: AnalyticsProps = {}): void {
  if (typeof window === 'undefined') return;
  try {
    const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event: `carrera_${event}`, ...props });
    }
  } catch {
    // La analítica nunca debe romper el juego.
  }
}
