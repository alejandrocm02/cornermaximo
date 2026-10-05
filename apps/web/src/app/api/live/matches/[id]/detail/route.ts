import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { FOOTBALL_DATA_CACHE_TAG } from '@/lib/cache';
import { isNewRefresh } from '@/lib/liveGuard';
import { guardedMatchDetail } from '@/lib/liveThrottle';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=240, stale-while-revalidate=240',
  'CDN-Cache-Control': 'public, s-maxage=240, stale-while-revalidate=240',
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

  const outcome = await guardedMatchDetail(id);
  if (outcome.kind === 'not_found') {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  }
  // Fuera de su ventana de directo no hay nada que descargar del proveedor.
  if (outcome.kind === 'stored') {
    return NextResponse.json(
      { processed: 0, terminal: outcome.terminal, refreshedAt: new Date().toISOString() },
      { headers: CACHE_HEADERS },
    );
  }
  if (!outcome.result.ok) {
    return NextResponse.json(
      { error: 'No se pudieron actualizar las estadísticas en directo' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = outcome.result.value;
  if (result == null) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

  if (result.processed > 0 && isNewRefresh(`detail:${id}`, outcome.result.at)) {
    revalidateTag('matches', { expire: 0 });
    revalidateTag(FOOTBALL_DATA_CACHE_TAG, { expire: 0 });
  }

  return NextResponse.json(result, { headers: CACHE_HEADERS });
}
