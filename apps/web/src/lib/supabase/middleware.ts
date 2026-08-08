import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'));
}

function markPrivateNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let refreshedSession = false;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          refreshedSession = cookiesToSet.length > 0;
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Supabase recomienda validar/refrescar la identidad con getClaims() en SSR.
  // No se confía en getSession() para decisiones de autorización del servidor.
  await supabase.auth.getClaims();

  // Evita que una CDN almacene una respuesta con Set-Cookie y la sirva a otro usuario.
  // También evita cachear respuestas públicas visitadas por un usuario autenticado.
  if (refreshedSession || hasSupabaseAuthCookie(request)) {
    markPrivateNoStore(response);
  }

  return response;
}
