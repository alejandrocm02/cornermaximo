import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { FOOTBALL_DATA_CACHE_TAG } from '@/lib/cache';
import { isFreshRefresh } from '@/lib/liveGuard';
import { throttledScoreboard } from '@/lib/liveThrottle';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const scoreboard = await throttledScoreboard();
  if (!scoreboard.ok) {
    return NextResponse.json(
      { error: 'No se pudo actualizar el marcador en directo' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Solo se invalidan las páginas cuando esta petición ha sincronizado de
  // verdad y algo ha cambiado. Invalidar en cada sondeo (cada 20-80 s por
  // visitante) dejaba sin efecto la caché de toda la web.
  const result = scoreboard.value;
  if (result.updated > 0 && isFreshRefresh(result.refreshedAt)) {
    revalidateTag('matches', { expire: 0 });
    revalidateTag(FOOTBALL_DATA_CACHE_TAG, { expire: 0 });
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
      'CDN-Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
    },
  });
}
