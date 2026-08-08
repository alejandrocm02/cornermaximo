import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    {
      status,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    },
  );
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireSyncAuth(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  const secret = process.env.SYNC_SECRET;
  if (secret == null || secret.length < 32 || !header.startsWith(prefix)) return false;

  const candidate = header.slice(prefix.length);
  return candidate !== '' && safeEqual(candidate, secret);
}
