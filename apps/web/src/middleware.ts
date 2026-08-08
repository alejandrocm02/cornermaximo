import { NextResponse, type NextRequest } from 'next/server';
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

export async function middleware(request: NextRequest) {
  const canonicalRedirect = canonicalAuthRedirect(request);
  if (canonicalRedirect) return canonicalRedirect;

  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
