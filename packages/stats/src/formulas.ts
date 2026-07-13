/**
 * Fórmulas estadísticas centralizadas.
 * Reglas obligatorias:
 *  - null de entrada = "dato no disponible" y se propaga (nunca se trata como 0).
 *  - División por cero => null, jamás Infinity/NaN.
 *  - Redondeo solo en presentación; aquí máximo 2 decimales para estabilidad.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** total / partidos. null si no hay dato o no hay partidos. */
export function perMatch(total: number | null | undefined, matches: number): number | null {
  if (total == null || !Number.isFinite(total)) return null;
  if (!Number.isFinite(matches) || matches <= 0) return null;
  return round2(total / matches);
}

/** total / minutos × 90. null si no hay dato o 0 minutos. */
export function per90(total: number | null | undefined, minutes: number): number | null {
  if (total == null || !Number.isFinite(total)) return null;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return round2((total / minutes) * 90);
}

/** parte / total × 100. null si falta cualquiera o total = 0. */
export function percentage(
  part: number | null | undefined,
  whole: number | null | undefined,
): number | null {
  if (part == null || whole == null) return null;
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  return round2((part / whole) * 100);
}

export const passAccuracy = (completed: number | null, attempted: number | null) =>
  percentage(completed, attempted);

export const tackleSuccessRate = (won: number | null, attempted: number | null) =>
  percentage(won, attempted);

export const duelWinRate = (won: number | null, total: number | null) =>
  percentage(won, total);

export const dribbleSuccessRate = (completed: number | null, attempted: number | null) =>
  percentage(completed, attempted);

export const savePercentage = (saves: number | null, shotsOnTargetFaced: number | null) =>
  percentage(saves, shotsOnTargetFaced);

/**
 * Suma valores nullable: si TODOS son null devuelve null (métrica no disponible);
 * si alguno existe, suma tratando los null restantes como ausentes.
 */
export function sumNullable(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}
