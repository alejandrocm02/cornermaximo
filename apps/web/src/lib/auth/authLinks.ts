/**
 * Enlaces de los correos de Supabase (confirmación de cuenta y recuperación de
 * contraseña).
 *
 * Si la URL de vuelta no está en la lista de "Redirect URLs" de Supabase, el
 * correo lleva a la URL del sitio (la portada) con `?code=…`, `?token_hash=…`
 * o `?error_code=…`, y la portada los ignoraba: el enlace "no hacía nada".
 * `authLinkTarget` reconduce esas visitas a la ruta que sabe procesarlas.
 */

/** Ruta interna que debe procesar un enlace de autenticación recibido en la portada, o `null`. */
export function authLinkTarget(url: URL): string | null {
  if (url.pathname !== '/') return null;
  const params = url.searchParams;

  if (params.has('token_hash') && params.has('type')) {
    return `/auth/confirm?${params.toString()}`;
  }
  if (params.has('code')) {
    return `/auth/callback?code=${encodeURIComponent(params.get('code')!)}`;
  }
  if (params.has('error_code') || (params.has('error') && params.has('error_description'))) {
    return `/auth/forgot-password?error=${linkErrorReason(params.get('error_code'))}`;
  }
  return null;
}

/** Motivo legible por la página de destino a partir del `error_code` de Supabase. */
export function linkErrorReason(code: string | null): 'expired' | 'invalid' {
  return code === 'otp_expired' ? 'expired' : 'invalid';
}

/** Texto para el usuario según el motivo por el que el enlace no sirvió. */
export const LINK_ERROR_MESSAGE: Record<'expired' | 'invalid', string> = {
  expired: 'El enlace ha caducado o ya se usó. Solicita uno nuevo.',
  invalid:
    'No se ha podido validar el enlace. Solicita uno nuevo y ábrelo en este mismo navegador si el problema continúa.',
};

/** ¿La sesión recién creada procede de un enlace de recuperación de contraseña? */
export function isRecoverySession(amr: unknown): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some((entry) =>
    typeof entry === 'string' ? entry === 'recovery' : (entry as { method?: unknown })?.method === 'recovery',
  );
}

const EMAIL_OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;
export type SupportedEmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

export function parseEmailOtpType(value: string | null): SupportedEmailOtpType | null {
  return EMAIL_OTP_TYPES.find((type) => type === value) ?? null;
}
