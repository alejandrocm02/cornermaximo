/**
 * Reglas puras de los endpoints públicos de directo. Viven aparte de
 * `liveThrottle` (que depende de Next y de la base de datos) para poder
 * probarlas sin entorno.
 */

/** Ventana alrededor del inicio en la que un partido puede necesitar datos en directo. */
export const LIVE_WINDOW_BEFORE_MS = 2 * 60 * 60 * 1000;
export const LIVE_WINDOW_AFTER_MS = 5 * 60 * 60 * 1000;

/**
 * ¿Merece este partido una consulta al proveedor ahora mismo?
 *
 * Los endpoints de directo son públicos y cada consulta gasta cuota de la API.
 * Sin esta comprobación, pedir `/api/live/matches/<id>/core` para cualquiera de
 * los miles de partidos de la base (terminados hace meses o por jugarse) costaba
 * dos peticiones al proveedor cada vez.
 *
 * Se admite FINISHED dentro de la ventana para la descarga final de
 * estadísticas que el cliente pide justo al acabar el encuentro.
 */
export function isLiveEligible(status: string, kickoffAt: Date, now: number = Date.now()): boolean {
  if (status !== 'LIVE' && status !== 'SCHEDULED' && status !== 'FINISHED') return false;
  const delta = now - kickoffAt.getTime();
  if (!Number.isFinite(delta)) return false;
  return delta >= -LIVE_WINDOW_BEFORE_MS && delta <= LIVE_WINDOW_AFTER_MS;
}

/** ¿Sigue vigente un resultado del throttle obtenido en `at`? */
export function isWithinInterval(at: string, intervalMs: number, now: number = Date.now()): boolean {
  const age = now - Date.parse(at);
  return Number.isFinite(age) && age <= intervalMs;
}

const lastSeenRefresh = new Map<string, string>();

/**
 * ¿Es la primera vez que esta instancia ve este resultado?
 *
 * Decide cuándo invalidar las páginas: una vez por sincronización real, no
 * una vez por petición. Comparar con "hace menos de N segundos" no sirve: el
 * throttle entrega resultados calculados por otra petición, así que casi nunca
 * son recientes y las páginas no llegaban a actualizarse durante un directo.
 */
export function isNewRefresh(key: string, at: string): boolean {
  if (lastSeenRefresh.get(key) === at) return false;
  if (lastSeenRefresh.size > 500) lastSeenRefresh.clear();
  lastSeenRefresh.set(key, at);
  return true;
}
