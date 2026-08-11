/**
 * GET /api/apuestas/resultados?ids=1,2,3 — estado y marcador final de partidos
 * para resolver selecciones de apuestas simuladas en el cliente.
 */
import { prisma } from '@cornermaximo/db';
import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get('ids') ?? '';
  const ids = [...new Set(raw.split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 100);
  if (ids.length === 0) return jsonError(422, 'INVALID_QUERY', 'Indica ids de partido separados por comas.');

  const matches = await prisma.match.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      teams: { select: { isHome: true, goals: true } },
    },
  });

  return NextResponse.json({
    results: matches.map((m) => ({
      id: m.id,
      status: m.status,
      homeGoals: m.teams.find((t) => t.isHome)?.goals ?? null,
      awayGoals: m.teams.find((t) => !t.isHome)?.goals ?? null,
    })),
  });
}
