import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { FOOTBALL_DATA_CACHE_TAG } from '@/lib/cache';
import { isNewRefresh } from '@/lib/liveGuard';
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

  // Las páginas se invalidan una vez por sincronización que haya cambiado
  // algo, no en cada sondeo (cada 20-80 s por visitante): eso dejaba sin
  // efecto la caché de toda la web.
  const result = scoreboard.value;
  if (result.updated > 0 && isNewRefresh('scoreboard', scoreboard.at)) {
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
