import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { liveInvalidationTags } from '@/lib/cache';
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

  // Las páginas se invalidan una vez por sincronización y solo con lo que
  // cambió: marcadores -> vistas de partidos; partido terminado -> también
  // fichas y rankings. Ver liveInvalidationTags.
  const result = scoreboard.value;
  if (isNewRefresh('scoreboard', scoreboard.at)) {
    for (const tag of liveInvalidationTags({ matchDataChanged: result.changed > 0, matchFinished: result.finished > 0 })) {
      revalidateTag(tag, { expire: 0 });
    }
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
      'CDN-Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
    },
  });
}
