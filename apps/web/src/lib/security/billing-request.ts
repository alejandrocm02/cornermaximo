function firstForwardedValue(value: string | null): string | null {
  return value?.split(',')[0]?.trim() || null;
}

/**
 * Checkout and portal endpoints mutate billing state, so browser form posts
 * must come from the same origin that received the authenticated session.
 */
export function isSameOriginBillingRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const host =
      firstForwardedValue(request.headers.get('x-forwarded-host')) ??
      request.headers.get('host') ??
      requestUrl.host;
    const protocol =
      firstForwardedValue(request.headers.get('x-forwarded-proto')) ??
      requestUrl.protocol.replace(':', '');

    return originUrl.host === host && originUrl.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}
