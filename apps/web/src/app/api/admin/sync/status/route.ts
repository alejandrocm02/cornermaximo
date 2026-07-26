/**
 * GET /api/admin/sync/status — diagnóstico de la sincronización.
 * Protegido con Bearer SYNC_SECRET, igual que /api/admin/sync/run.
 *
 * Responde a las preguntas que hay que hacerse cuando los datos se quedan
 * congelados: ¿qué falló, cuándo, cuántas veces, y queda presupuesto de API?
 * Es de solo lectura: no lanza ninguna sincronización ni gasta requests.
 */
import { prisma } from '@futstats/db';
import { NextResponse } from 'next/server';
import { jsonError, requireSyncAuth } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Horas transcurridas desde una fecha, redondeadas a una decimal. */
function hoursSince(date: Date | null | undefined): number | null {
  if (date == null) return null;
  return Math.round(((Date.now() - date.getTime()) / 3_600_000) * 10) / 10;
}

export async function GET(request: Request) {
  if (!requireSyncAuth(request)) {
    return jsonError(401, 'UNAUTHORIZED', 'Token de sincronización inválido.');
  }

  const todayUtc = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
  );

  const [
    failedJobs,
    recentLogs,
    budgetToday,
    lastSuccessByEntity,
    freshness,
    injuriesOpen,
    playersByStatus,
  ] = await Promise.all([
    // Trabajos fallidos más recientes: la causa de un atasco suele estar aquí.
    prisma.syncJob.findMany({
      where: { status: 'FAILED' },
      orderBy: { finishedAt: 'desc' },
      take: 20,
      select: {
        entity: true,
        entityExternalId: true,
        error: true,
        attempts: true,
        finishedAt: true,
        priority: true,
      },
    }),
    prisma.syncLog.findMany({
      where: { level: 'error' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { message: true, createdAt: true },
    }),
    prisma.requestBudget.findFirst({
      where: { date: todayUtc },
      select: { used: true, dailyLimit: true, date: true },
    }),
    prisma.syncJob.groupBy({
      by: ['entity'],
      where: { status: 'SUCCESS' },
      _max: { finishedAt: true },
    }),
    // Frescura real del dato que ve el usuario.
    prisma.playerMatchStatistics.aggregate({ _max: { syncedAt: true } }),
    prisma.injury.count({ where: { resolvedAt: null } }),
    prisma.player.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  // Partidos ya jugados que siguen sin resultado o sin estadísticas: el síntoma
  // más directo de que la cola no está avanzando.
  const [pendingResults, finishedWithoutStats, nextScheduled] = await Promise.all([
    prisma.match.count({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] },
        kickoffAt: { lt: new Date() },
      },
    }),
    prisma.match.count({ where: { status: 'FINISHED', matchPlayers: { none: {} } } }),
    prisma.match.findFirst({
      where: { status: 'SCHEDULED', kickoffAt: { gte: new Date() } },
      orderBy: { kickoffAt: 'asc' },
      select: { kickoffAt: true, externalId: true },
    }),
  ]);

  // Se devuelven las filas tal cual salen de la base de datos, sin
  // transformarlas: evita depender de la inferencia de tipos del cliente de
  // Prisma y el consumidor tiene igualmente todas las marcas de tiempo.
  // `generadoEn` permite calcular la antigüedad de cualquiera de ellas.
  return NextResponse.json({
    generadoEn: new Date().toISOString(),
    presupuestoHoy: budgetToday ?? { used: 0, dailyLimit: null, date: todayUtc.toISOString() },
    frescura: {
      ultimaEstadisticaSincronizada: freshness._max.syncedAt,
      horasDesdeUltimaEstadistica: hoursSince(freshness._max.syncedAt),
    },
    cola: {
      partidosJugadosSinResultado: pendingResults,
      partidosFinalizadosSinEstadisticas: finishedWithoutStats,
      proximoPartido: nextScheduled,
    },
    lesiones: {
      abiertas: injuriesOpen,
      jugadoresPorEstado: playersByStatus,
    },
    ultimoExitoPorEntidad: lastSuccessByEntity,
    trabajosFallidos: failedJobs,
    erroresRecientes: recentLogs,
  });
}
