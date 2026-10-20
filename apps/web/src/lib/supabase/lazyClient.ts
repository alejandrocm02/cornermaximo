/**
 * Acceso diferido al cliente de Supabase en el navegador.
 *
 * El SDK de Supabase (~55 KB comprimidos) se cargaba en todas las páginas
 * porque el layout importa la sincronización de favoritos. La mayoría de
 * visitas no tienen cuenta: el SDK solo se descarga cuando una función de
 * cuenta lo necesita de verdad.
 */
export async function getSupabaseClient() {
  const { createClient } = await import('./client');
  return createClient();
}

/** ¿Hay una sesión de Supabase guardada en las cookies de este navegador? */
export function hasSupabaseSessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((cookie) => {
    const name = cookie.trim().split('=')[0] ?? '';
    return name.startsWith('sb-') && name.includes('-auth-token');
  });
}
