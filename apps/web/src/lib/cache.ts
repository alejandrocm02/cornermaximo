export const FOOTBALL_DATA_CACHE_TAG = 'football-data';
export const FOOTBALL_DATA_REVALIDATE_SECONDS = 60 * 60;

/** Etiqueta de las consultas de partidos (calendario, match center, alertas). */
export const MATCHES_CACHE_TAG = 'matches';

export interface LiveRefreshChanges {
  /** Algo visible del partido cambió: marcador, estado, eventos o estadísticas del acta. */
  matchDataChanged: boolean;
  /** Algún partido ha terminado: sus estadísticas entran en fichas, rankings y medias. */
  matchFinished: boolean;
}

/**
 * Etiquetas que hay que invalidar tras un refresco en directo.
 *
 * Mientras un partido se juega solo cambian las vistas de partidos. Las fichas
 * de jugador, los rankings y los "últimos 5" cuentan únicamente partidos
 * finalizados, así que la etiqueta global se reserva para cuando un partido
 * termina. Antes cada refresco (cada 20-80 s por partido en juego) vaciaba la
 * caché de toda la web y en jornada cada ficha volvía a la base de datos.
 */
export function liveInvalidationTags(changes: LiveRefreshChanges): string[] {
  if (changes.matchFinished) return [MATCHES_CACHE_TAG, FOOTBALL_DATA_CACHE_TAG];
  if (changes.matchDataChanged) return [MATCHES_CACHE_TAG];
  return [];
}
