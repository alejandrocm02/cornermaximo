/**
 * GET /api/compare?players=slug1,slug2&periodo=5|10|temporada
 * Comparación de 2 jugadores en la ventana elegida.
 */
import { prisma } from '@cornermaximo/db';
import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api';
import { getLastMatches, type ComparisonWindow } from '@/lib/recent';

export const dynamic = 'force-dynamic';

const PERIODS: Record<string, ComparisonWindow> = { '5': 5, '10': 10, temporada: 'season' };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slugs = (url.searchParams.get('players') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const periodo = url.searchParams.get('periodo') ?? '5';
  const window = PERIODS[periodo] ?? 5;
  if (slugs.length !== 2) {
    return jsonError(422, 'INVALID_QUERY', 'Se requieren exactamente 2 jugadores: ?players=a,b');
  }

  const players = await prisma.player.findMany({
    where: { slug: { in: slugs } },
    include: {
      currentTeam: { select: { name: true, crestUrl: true } },
      positions: { where: { isPrimary: true } },
      nationality: { select: { name: true } },
    },
  });
  if (players.length !== 2) return jsonError(404, 'NOT_FOUND', 'Algún jugador no existe.');

  const ordered = slugs.map((s) => players.find((p) => p.slug === s)!);
  const groups = ordered.map((p) => p.positions[0]?.group ?? null);
  const bothGk = groups.every((g) => g === 'GK');
  const anyGk = groups.some((g) => g === 'GK');

  const summaries = await Promise.all(
    ordered.map((p) => getLastMatches(p.id, p.positions[0]?.group === 'GK', window)),
  );

  return NextResponse.json({
    periodo,
    warning:
      anyGk && !bothGk
        ? 'Comparación entre portero y jugador de campo: solo las métricas generales son equivalentes.'
        : groups[0] !== groups[1]
          ? 'Posiciones diferentes: la comparación puede no ser equivalente.'
          : null,
    template: bothGk ? 'goalkeeper' : 'field',
    players: ordered.map((p, i) => ({
      slug: p.slug,
      name: p.knownAs ?? p.fullName,
      photoUrl: p.photoUrl,
      team: p.currentTeam?.name ?? null,
      position: groups[i],
      nationality: p.nationality?.name ?? null,
      lastMatches: summaries[i],
    })),
  });
}
