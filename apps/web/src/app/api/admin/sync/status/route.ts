/**
 * GET /api/admin/sync/status — diagnóstico detallado de la sincronización.
 * Protegido con Bearer SYNC_SECRET, igual que /api/admin/sync/run.
 * Es de solo lectura: no lanza trabajos ni consume cuota del proveedor.
 */
import { NextResponse } from 'next/server';
import { jsonError, requireSyncAuth } from '@/lib/api';
import { getSyncDiagnostics } from '@/lib/syncDiagnostics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!requireSyncAuth(request)) {
    return jsonError(401, 'UNAUTHORIZED', 'Token de sincronización inválido.');
  }

  return NextResponse.json(await getSyncDiagnostics());
}
