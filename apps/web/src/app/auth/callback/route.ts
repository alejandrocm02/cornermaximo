import { NextResponse } from 'next/server';
import { isRecoverySession, linkErrorReason } from '@/lib/auth/authLinks';
import { safeInternalPath } from '@/lib/security/redirect';
import { createClient } from '@/lib/supabase/server';

function redirectTo(path: string, origin: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeInternalPath(url.searchParams.get('next'), '/cuenta');

  // Supabase devuelve el fallo del enlace (p. ej. caducado) en la propia URL.
  const errorCode = url.searchParams.get('error_code');
  if (errorCode != null) return redirectTo(`/auth/login?error=${linkErrorReason(errorCode)}`, url.origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Si el enlace llegó sin `next` (p. ej. Supabase lo mandó a la portada),
      // una sesión de recuperación debe acabar igualmente en el cambio de
      // contraseña y no en la cuenta.
      const { data } = await supabase.auth.getClaims();
      if (isRecoverySession(data?.claims?.amr)) return redirectTo('/auth/update-password', url.origin);
      return redirectTo(next, url.origin);
    }
    // Sin la cookie del navegador donde se pidió el enlace, el intercambio PKCE falla.
    return redirectTo(
      next === '/auth/update-password' ? '/auth/forgot-password?error=invalid' : '/auth/login?error=invalid',
      url.origin,
    );
  }

  return redirectTo('/auth/login?error=invalid', url.origin);
}
