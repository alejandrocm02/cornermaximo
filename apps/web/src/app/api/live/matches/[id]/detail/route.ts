import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { FOOTBALL_DATA_CACHE_TAG } from '@/lib/cache';
import { syncLiveMatchDetail } from '@/lib/liveMatchSync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseMatchId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseMatchId(rawId);
  if (id == null) return NextResponse.json({ error: 'Partido inválido' }, { status: 400 });

  try {
    const result = await syncLiveMatchDetail(id);
    if (result == null) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

    revalidateTag('matches', { expire: 0 });
    revalidateTag(FOOTBALL_DATA_CACHE_TAG, { expire: 0 });

    return NextResponse.json(
      { ...result, refreshedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60',
          'CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60',
        },
      },
    );
  } catch (error) {
    console.error('live match detail sync failed', error);
    return NextResponse.json(
      { error: 'No se pudieron actualizar las estadísticas en directo' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
