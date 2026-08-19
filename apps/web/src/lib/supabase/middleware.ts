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

function isMissingRefreshToken(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'refresh_token_not_found',
  );
}

function clearStaleAuthCookies(request: NextRequest, response: NextResponse): void {
  for (const { name } of request.cookies.getAll()) {
    if (!name.startsWith('sb-') || !name.includes('-auth-token')) continue;
    request.cookies.delete(name);
    response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
}

export async function updateSession(request: NextRequest, requestHeaders?: Headers) {
  const nextResponse = () =>
    requestHeaders
      ? NextResponse.next({ request: { headers: requestHeaders } })
      : NextResponse.next({ request });
  let response = nextResponse();
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
          response = nextResponse();
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Supabase recomienda validar/refrescar la identidad con getClaims() en SSR.
  // No se confía en getSession() para decisiones de autorización del servidor.
  try {
    const { error } = await supabase.auth.getClaims();
    if (isMissingRefreshToken(error)) clearStaleAuthCookies(request, response);
  } catch (error) {
    if (isMissingRefreshToken(error)) {
      clearStaleAuthCookies(request, response);
    } else {
      throw error;
    }
  }

  // Evita que una CDN almacene una respuesta con Set-Cookie y la sirva a otro usuario.
  // También evita cachear respuestas públicas visitadas por un usuario autenticado.
  if (refreshedSession || hasSupabaseAuthCookie(request)) {
    markPrivateNoStore(response);
  }

  return response;
}
