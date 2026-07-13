import { NextResponse } from 'next/server';

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function requireSyncAuth(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const secret = process.env.SYNC_SECRET;
  return secret != null && secret !== '' && header === `Bearer ${secret}`;
}
