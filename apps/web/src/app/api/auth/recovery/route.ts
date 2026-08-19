import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';

const GENERIC_SUCCESS =
  'Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña.';
const RATE_LIMIT_MESSAGE =
  'Has solicitado demasiados enlaces. Espera unos minutos antes de volver a intentarlo.';

function jsonNoStore(body: Record<string, string>, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

function isValidEmail(value: string): boolean {
  return value.length > 3 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: 'Solicitud no válida.' }, 400);
  }

  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const captchaToken =
    typeof payload.captchaToken === 'string' && payload.captchaToken.trim()
      ? payload.captchaToken.trim()
      : undefined;

  if (!isValidEmail(email)) {
    return jsonNoStore({ error: 'Introduce un correo electrónico válido.' }, 400);
  }

  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
    return jsonNoStore({ error: 'Completa la verificación anti-bot antes de continuar.' }, 400);
  }

  const supabase = await createClient();
  const redirectTo = `${getSiteUrl()}/auth/callback?next=/auth/update-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
    ...(captchaToken ? { captchaToken } : {}),
  });

  if (error) {
    if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
      return jsonNoStore({ error: RATE_LIMIT_MESSAGE }, 429);
    }

    return jsonNoStore(
      { error: 'No se ha podido enviar el enlace de recuperación. Inténtalo de nuevo.' },
      400,
    );
  }

  return jsonNoStore({ message: GENERIC_SUCCESS });
}
