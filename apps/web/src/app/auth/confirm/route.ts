import { NextResponse } from 'next/server';
import { linkErrorReason, parseEmailOtpType } from '@/lib/auth/authLinks';
import { safeInternalPath } from '@/lib/security/redirect';
import { createClient } from '@/lib/supabase/server';

/**
 * Destino de los enlaces de correo con `token_hash` (plantillas de Supabase):
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password
 *
 * A diferencia de `/auth/callback` (flujo PKCE), no necesita la cookie que se
 * guarda al pedir el enlace, así que funciona aunque el correo se abra en otro
 * dispositivo o navegador.
 */
function redirectTo(path: string, origin: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = parseEmailOtpType(url.searchParams.get('type'));
  const fallback = type === 'recovery' ? '/auth/update-password' : '/cuenta';
  const next = safeInternalPath(url.searchParams.get('next'), fallback);

  if (tokenHash != null && type != null) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error == null) return redirectTo(type === 'recovery' ? '/auth/update-password' : next, url.origin);
    const reason = linkErrorReason(error.code ?? null);
    return redirectTo(
      type === 'recovery' ? `/auth/forgot-password?error=${reason}` : `/auth/login?error=${reason}`,
      url.origin,
    );
  }

  return redirectTo('/auth/login?error=invalid', url.origin);
}
