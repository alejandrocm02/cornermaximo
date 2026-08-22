import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { FOOTBALL_DATA_CACHE_TAG } from '@/lib/cache';
import { syncLiveScoreboard } from '@/lib/liveMatchSync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await syncLiveScoreboard();
    revalidateTag('matches', { expire: 0 });
    revalidateTag(FOOTBALL_DATA_CACHE_TAG, { expire: 0 });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        'CDN-Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('live scoreboard sync failed', error);
    return NextResponse.json(
      { error: 'No se pudo actualizar el marcador en directo' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
