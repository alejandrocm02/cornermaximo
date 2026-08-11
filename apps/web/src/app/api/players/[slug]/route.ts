/** GET /api/players/:slug — perfil + agregados de temporada. */
import { prisma } from '@cornermaximo/db';
import { percentage } from '@cornermaximo/stats';
import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const player = await prisma.player.findUnique({
    where: { slug },
    include: {
      currentTeam: { select: { name: true, slug: true, crestUrl: true } },
      positions: true,
      nationality: { select: { name: true } },
      secondNationality: { select: { name: true } },
      injuries: { where: { resolvedAt: null }, orderBy: { startDate: 'desc' }, take: 1 },
    },
  });
  if (player == null) return jsonError(404, 'NOT_FOUND', 'Jugador no encontrado.');

  const isGoalkeeper = player.positions.some((p) => p.isPrimary && p.group === 'GK');

  const [appearances, fieldTotals, gkTotals] = await Promise.all([
    prisma.matchPlayer.aggregate({
      where: { playerId: player.id, match: { status: 'FINISHED' } },
      _sum: { minutesPlayed: true },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    prisma.playerMatchStatistics.aggregate({
      where: { matchPlayer: { playerId: player.id } },
      _sum: { goals: true, assists: true, yellowCards: true, redCards: true, keyPasses: true, passesAttempted: true, passesCompleted: true },
    }),
    prisma.goalkeeperMatchStatistics.aggregate({
      where: { matchPlayer: { playerId: player.id } },
      _sum: { saves: true, goalsConceded: true, shotsOnTargetFaced: true },
    }),
  ]);

  const starts = await prisma.matchPlayer.count({
    where: { playerId: player.id, role: 'STARTER', match: { status: 'FINISHED' } },
  });
  const played = await prisma.matchPlayer.count({
    where: { playerId: player.id, minutesPlayed: { gt: 0 }, match: { status: 'FINISHED' } },
  });

  const age =
    player.birthDate != null
      ? Math.floor((Date.now() - player.birthDate.getTime()) / (365.25 * 24 * 3_600_000))
      : null;

  return NextResponse.json({
    slug: player.slug,
    fullName: player.fullName,
    knownAs: player.knownAs,
    photoUrl: player.photoUrl,
    birthDate: player.birthDate,
    age,
    nationality: player.nationality?.name ?? null,
    secondNationality: player.secondNationality?.name ?? null,
    heightCm: player.heightCm,
    weightKg: player.weightKg,
    preferredFoot: player.preferredFoot,
    shirtNumber: player.shirtNumber,
    status: player.status,
    activeInjury: player.injuries[0] ?? null,
    team: player.currentTeam,
    positions: player.positions.map((p) => ({ group: p.group, isPrimary: p.isPrimary })),
    isGoalkeeper,
    season: {
      played,
      starts,
      minutes: appearances._sum.minutesPlayed ?? 0,
      avgRating: appearances._avg.rating,
      goals: fieldTotals._sum.goals,
      assists: fieldTotals._sum.assists,
      keyPasses: fieldTotals._sum.keyPasses,
      passAccuracy: percentage(fieldTotals._sum.passesCompleted, fieldTotals._sum.passesAttempted),
      yellowCards: fieldTotals._sum.yellowCards,
      redCards: fieldTotals._sum.redCards,
      saves: gkTotals._sum.saves,
      goalsConceded: gkTotals._sum.goalsConceded,
      savePercentage: percentage(gkTotals._sum.saves, gkTotals._sum.shotsOnTargetFaced),
    },
  });
}
