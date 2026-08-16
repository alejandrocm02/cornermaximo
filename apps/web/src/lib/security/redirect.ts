const INTERNAL_BASE = 'https://cornermaximo.invalid';

/**
 * Accepts only same-origin relative paths. Values such as //evil.example,
 * absolute URLs and malformed backslash variants fall back safely.
 */
export function safeInternalPath(value: string | null | undefined, fallback = '/'): string {
  if (value == null || value === '' || !value.startsWith('/')) return fallback;

  try {
    const resolved = new URL(value, INTERNAL_BASE);
    if (resolved.origin !== INTERNAL_BASE) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
