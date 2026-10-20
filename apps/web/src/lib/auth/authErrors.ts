// Supabase Auth devuelve los errores en inglés ("Invalid login credentials").
// Este módulo los traduce para que nunca lleguen tal cual a la interfaz.
// Se prioriza `code` (estable entre versiones) y se usa el mensaje solo como
// respaldo para respuestas antiguas que no lo incluyen.

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada o el correo no deseado.',
  user_already_exists: 'Ya existe una cuenta con este correo. Inicia sesión o recupera la contraseña.',
  email_exists: 'Ya existe una cuenta con este correo. Inicia sesión o recupera la contraseña.',
  weak_password: 'La contraseña no cumple los requisitos de seguridad.',
  same_password: 'La nueva contraseña debe ser distinta de la actual.',
  email_address_invalid: 'Introduce un correo electrónico válido.',
  validation_failed: 'Revisa los datos introducidos.',
  captcha_failed: 'No se ha podido validar la verificación anti-bot. Inténtalo de nuevo.',
  over_request_rate_limit: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.',
  over_email_send_rate_limit: 'Se han enviado demasiados correos. Espera unos minutos antes de pedir otro.',
  signup_disabled: 'El registro de cuentas nuevas está desactivado en este momento.',
  session_not_found: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  session_expired: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  refresh_token_not_found: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  reauthentication_needed: 'Por seguridad, vuelve a iniciar sesión antes de cambiar la contraseña.',
  user_banned: 'Esta cuenta está bloqueada.',
};

const BY_MESSAGE: Array<[RegExp, string]> = [
  [/invalid login credentials/i, BY_CODE.invalid_credentials!],
  [/email not confirmed/i, BY_CODE.email_not_confirmed!],
  [/already registered|already exists/i, BY_CODE.user_already_exists!],
  [/should be different from the old password/i, BY_CODE.same_password!],
  [/password should be|weak password/i, BY_CODE.weak_password!],
  [/captcha/i, BY_CODE.captcha_failed!],
  [/rate limit|too many requests/i, BY_CODE.over_request_rate_limit!],
  [/auth session missing|session.*(expired|not found)/i, BY_CODE.session_not_found!],
  [/failed to fetch|network/i, 'No hay conexión con el servicio de cuentas. Comprueba tu conexión e inténtalo de nuevo.'],
];

export const GENERIC_AUTH_ERROR = 'No se ha podido completar la operación. Inténtalo de nuevo.';

export function authErrorMessage(error: unknown, fallback: string = GENERIC_AUTH_ERROR): string {
  if (!error || typeof error !== 'object') return fallback;

  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
  if (code && BY_CODE[code]) return BY_CODE[code];

  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  for (const [pattern, translated] of BY_MESSAGE) {
    if (pattern.test(message)) return translated;
  }

  // Un mensaje desconocido puede venir en inglés o contener detalles técnicos:
  // se muestra el texto genérico y el original queda solo en la consola.
  if (message) console.warn('auth: error no traducido', code ?? '', message);
  return fallback;
}
