/**
 * POST /api/admin/sync/run — lanzado por GitHub Actions (o manualmente).
 * Protegido con Bearer SYNC_SECRET. Ejecuta la cola de sincronización
 * respetando el presupuesto diario de la API.
 */
import { prisma } from '@futstats/db';
import { runSync } from '@futstats/sync';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, requireSyncAuth } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // límite de Vercel Hobby

const bodySchema = z.object({
  maxRequests: z.number().int().min(1).max(1000).default(200),
});

export async function POST(request: Request) {
  if (!requireSyncAuth(request)) {
    return jsonError(401, 'UNAUTHORIZED', 'Token de sincronización inválido.');
  }

  let maxRequests = 200;
  try {
    const body: unknown = await request.json();
    maxRequests = bodySchema.parse(body).maxRequests;
  } catch {
    // cuerpo vacío o inválido: se usa el valor por defecto
  }

  try {
    const result = await runSync(prisma, { maxRequests });
    return NextResponse.json(result);
  } catch (err) {
    await prisma.syncLog.create({
      data: { level: 'error', message: `runSync: ${String(err)}`.slice(0, 900) },
    });
    return jsonError(500, 'SYNC_FAILED', 'La sincronización falló; revisa SyncLog.');
  }
}
