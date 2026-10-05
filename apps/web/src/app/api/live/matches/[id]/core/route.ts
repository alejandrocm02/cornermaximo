import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { FOOTBALL_DATA_CACHE_TAG } from '@/lib/cache';
import { isNewRefresh } from '@/lib/liveGuard';
import { guardedMatchCore } from '@/lib/liveThrottle';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=80, stale-while-revalidate=80',
  'CDN-Cache-Control': 'public, s-maxage=80, stale-while-revalidate=80',
};

function parseMatchId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseMatchId(rawId);
  if (id == null) return NextResponse.json({ error: 'Partido inválido' }, { status: 400 });

  const outcome = await guardedMatchCore(id);
  if (outcome.kind === 'not_found') {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  }
  // Fuera de su ventana de directo se responde con lo guardado, sin proveedor.
  if (outcome.kind === 'stored') {
    return NextResponse.json(outcome.snapshot, { headers: CACHE_HEADERS });
  }
  if (!outcome.result.ok) {
    return NextResponse.json(
      { error: 'No se pudo actualizar el partido en directo' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const snapshot = outcome.result.value;
  if (snapshot == null) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

  if (isNewRefresh(`core:${id}`, outcome.result.at)) {
    revalidateTag('matches', { expire: 0 });
    revalidateTag(FOOTBALL_DATA_CACHE_TAG, { expire: 0 });
  }

  return NextResponse.json(snapshot, { headers: CACHE_HEADERS });
}
