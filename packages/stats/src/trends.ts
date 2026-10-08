/**
 * Tendencias objetivas: compara la ventana reciente (últimos 5 con minutos)
 * con la anterior (los 5 previos), usando valores por 90 minutos.
 * Nunca se inventa una conclusión:
 *  - Ambas ventanas necesitan >= MIN_MINUTES_FOR_TREND minutos => si no, INSUFFICIENT_SAMPLE.
 *  - Banda de estabilidad de ±10% relativo (evita marcar tendencia por ruido).
 */
import { per90 } from './formulas';

export type TrendDirection = 'UP' | 'STABLE' | 'DOWN' | 'INSUFFICIENT_SAMPLE';

export const MIN_MINUTES_FOR_TREND = 180;
const STABILITY_BAND = 0.1; // ±10%

export interface TrendInput {
  /** Total de la métrica en la ventana reciente y sus minutos. */
  recentTotal: number | null;
  recentMinutes: number;
  /** Total de la métrica en la ventana anterior y sus minutos. */
  previousTotal: number | null;
  previousMinutes: number;
  /** true si "menos es mejor" (p.ej. goles encajados, pérdidas). */
  lowerIsBetter?: boolean;
}

export interface TrendResult {
  direction: TrendDirection;
  recentPer90: number | null;
  previousPer90: number | null;
  /** Variación relativa (recent vs previous), null si no computable. */
  relativeChange: number | null;
}

export function computeTrend(input: TrendInput): TrendResult {
  const { recentTotal, recentMinutes, previousTotal, previousMinutes, lowerIsBetter } = input;

  const recentPer90 = per90(recentTotal, recentMinutes);
  const previousPer90 = per90(previousTotal, previousMinutes);

  if (
    recentMinutes < MIN_MINUTES_FOR_TREND ||
    previousMinutes < MIN_MINUTES_FOR_TREND ||
    recentPer90 == null ||
    previousPer90 == null
  ) {
    return { direction: 'INSUFFICIENT_SAMPLE', recentPer90, previousPer90, relativeChange: null };
  }

  // Ambos cero: sin cambio.
  if (previousPer90 === 0 && recentPer90 === 0) {
    return { direction: 'STABLE', recentPer90, previousPer90, relativeChange: 0 };
  }

  // Base cero con valor reciente > 0: cambio claro.
  if (previousPer90 === 0) {
    const direction: TrendDirection = lowerIsBetter ? 'DOWN' : 'UP';
    return { direction, recentPer90, previousPer90, relativeChange: null };
  }

  const relativeChange = Math.round(((recentPer90 - previousPer90) / previousPer90) * 1000) / 1000;

  let direction: TrendDirection;
  if (Math.abs(relativeChange) <= STABILITY_BAND) {
    direction = 'STABLE';
  } else if (relativeChange > 0) {
    direction = lowerIsBetter ? 'DOWN' : 'UP';
  } else {
    direction = lowerIsBetter ? 'UP' : 'DOWN';
  }

  return { direction, recentPer90, previousPer90, relativeChange };
}

/** Racha: nº de partidos consecutivos (desde el más reciente) que cumplen un predicado. */
export function streak<T>(mostRecentFirst: T[], predicate: (line: T) => boolean): number {
  let count = 0;
  for (const line of mostRecentFirst) {
    if (!predicate(line)) break;
    count++;
  }
  return count;
}

/**
 * Tendencia de una métrica entre dos ventanas de partidos, contando en cada
 * ventana solo los partidos con dato para esa métrica. Así una ventana con
 * actas incompletas no parece "en descenso" por falta de datos, y el umbral de
 * minutos mínimos se aplica a los minutos realmente medidos.
 */
export function computeLineTrend<L extends { minutes: number }>(
  recent: L[],
  previous: L[],
  value: (line: L) => number | null,
  options: { lowerIsBetter?: boolean } = {},
): TrendResult {
  const measured = (lines: L[]) => {
    const withData = lines.filter((line) => value(line) != null);
    return {
      total: withData.length > 0 ? withData.reduce((a, line) => a + value(line)!, 0) : null,
      minutes: withData.reduce((a, line) => a + line.minutes, 0),
    };
  };
  const r = measured(recent);
  const p = measured(previous);
  return computeTrend({
    recentTotal: r.total,
    recentMinutes: r.minutes,
    previousTotal: p.total,
    previousMinutes: p.minutes,
    lowerIsBetter: options.lowerIsBetter,
  });
}
