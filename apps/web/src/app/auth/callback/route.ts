import { NextResponse } from 'next/server';
import { safeInternalPath } from '@/lib/security/redirect';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeInternalPath(url.searchParams.get('next'), '/cuenta');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL(next, url.origin));
      response.headers.set('Cache-Control', 'private, no-store, max-age=0');
      return response;
    }
  }

  const response = NextResponse.redirect(new URL('/auth/login?error=callback', url.origin));
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}
