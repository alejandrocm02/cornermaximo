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

/** Una respuesta servida desde el throttle no debe volver a invalidar cachés. */
export function isFreshRefresh(refreshedAt: string, now: number = Date.now()): boolean {
  const age = now - Date.parse(refreshedAt);
  return Number.isFinite(age) && age < 5_000;
}
