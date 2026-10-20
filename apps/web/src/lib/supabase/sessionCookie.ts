/**
 * ¿Es esta cookie una sesión de Supabase?
 *
 * La sesión se guarda como `sb-<proyecto>-auth-token`, troceada en
 * `sb-<proyecto>-auth-token.0`, `.1`… cuando no cabe en una cookie. El flujo
 * PKCE (login por enlace y recuperación de contraseña) deja además cookies
 * `sb-<proyecto>-auth-token-code-verifier` que no son una sesión: si se
 * contaban, un visitante que abrió un enlace de recuperación quedaba marcado
 * como "con sesión" (respuesta privada sin caché y SDK de Supabase cargado en
 * todas las páginas) aunque no hubiera iniciado sesión.
 */
const SESSION_COOKIE = /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i;

export function isSupabaseSessionCookie(name: string): boolean {
  return SESSION_COOKIE.test(name);
}

/** Cualquier cookie de autenticación de Supabase, incluidas las del flujo PKCE. */
export function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith('sb-') && name.includes('-auth-token');
}
