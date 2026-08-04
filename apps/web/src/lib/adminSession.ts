import { createHmac, timingSafeEqual } from 'node:crypto';

export const SYNC_ADMIN_COOKIE = 'futstats_sync_admin';
const SESSION_CONTEXT = 'futstats-sync-dashboard-v1';

function syncSecret(): string | null {
  const secret = process.env.SYNC_SECRET;
  return secret != null && secret !== '' ? secret : null;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionValue(secret: string): string {
  return createHmac('sha256', secret).update(SESSION_CONTEXT).digest('hex');
}

export function verifySyncAdminSecret(candidate: string): boolean {
  const secret = syncSecret();
  return secret != null && candidate !== '' && safeEqual(candidate, secret);
}

export function validSyncAdminSession(cookieValue: string | undefined): boolean {
  const secret = syncSecret();
  return secret != null && cookieValue != null && safeEqual(cookieValue, sessionValue(secret));
}

export function createSyncAdminSession(): string | null {
  const secret = syncSecret();
  return secret == null ? null : sessionValue(secret);
}
