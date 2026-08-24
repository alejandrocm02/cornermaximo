import { NextResponse, type NextRequest } from 'next/server';
import { createContentSecurityPolicy } from '@/lib/security/csp';
import { updateSession } from '@/lib/supabase/middleware';

function canonicalAuthRedirect(request: NextRequest): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith('/auth/')) return null;

  const targetEnvironment = process.env.VERCEL_TARGET_ENV ?? process.env.VERCEL_ENV;
  if (targetEnvironment !== 'production') return null;

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!productionHost || request.nextUrl.hostname === productionHost) return null;

  const canonicalUrl = request.nextUrl.clone();
  canonicalUrl.protocol = 'https:';
  canonicalUrl.hostname = productionHost;
  canonicalUrl.port = '';

  return NextResponse.redirect(canonicalUrl, 307);
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const contentSecurityPolicy = createContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === 'development',
  );
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const canonicalRedirect = canonicalAuthRedirect(request);
  if (canonicalRedirect) {
    canonicalRedirect.headers.set('Content-Security-Policy', contentSecurityPolicy);
    return canonicalRedirect;
  }

  // Stripe does not carry a Supabase session. Keep its signed webhook independent
  // from cookie refreshes so billing events can still be retried during auth incidents.
  if (request.nextUrl.pathname === '/api/billing/webhook') {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', contentSecurityPolicy);
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return response;
  }

  const response = await updateSession(request, requestHeaders);
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
