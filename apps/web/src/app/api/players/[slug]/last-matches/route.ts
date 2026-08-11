/** GET /api/players/:slug/last-matches — últimos 5 jugados + resumen + tendencias. */
import { prisma } from '@cornermaximo/db';
import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api';
import { getLastMatches } from '@/lib/recent';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = await prisma.player.findUnique({
    where: { slug },
    include: { positions: { where: { isPrimary: true } } },
  });
  if (player == null) return jsonError(404, 'NOT_FOUND', 'Jugador no encontrado.');

  const isGoalkeeper = player.positions[0]?.group === 'GK';
  const data = await getLastMatches(player.id, isGoalkeeper);
  return NextResponse.json(data);
}
