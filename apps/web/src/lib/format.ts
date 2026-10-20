// Formato numérico de la interfaz: coma decimal y separador de miles en español.
// `toFixed()` y `String()` producen "1.82", que en español se lee como mil
// ochocientos veinte; todo valor decimal visible debe pasar por aquí.

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(minimumFractionDigits: number, maximumFractionDigits: number): Intl.NumberFormat {
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat('es-ES', { minimumFractionDigits, maximumFractionDigits, useGrouping: true });
    formatters.set(key, cached);
  }
  return cached;
}

/** Número con como mucho `maxDigits` decimales (sin ceros sobrantes). "—" si no hay dato. */
export function formatNumber(value: number | null | undefined, maxDigits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatter(0, maxDigits).format(value);
}

/** Número con exactamente `digits` decimales, p. ej. valoraciones: 7,50. "—" si no hay dato. */
export function formatFixed(value: number | null | undefined, digits: number): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatter(digits, digits).format(value);
}
