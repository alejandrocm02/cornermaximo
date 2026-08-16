import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SYNC_ADMIN_COOKIE = 'cornermaximo_sync_admin';
const SESSION_CONTEXT = 'cornermaximo-sync-dashboard-v2';
const SESSION_DURATION_SECONDS = 4 * 60 * 60;
const CLOCK_SKEW_SECONDS = 60;

type AdminSessionPayload = {
  iat: number;
  exp: number;
  nonce: string;
};

function syncSecret(): string | null {
  const secret = process.env.SYNC_SECRET;
  return secret != null && secret.length >= 32 ? secret : null;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${SESSION_CONTEXT}.${encodedPayload}`)
    .digest('base64url');
}

function parseSession(token: string, secret: string): AdminSessionPayload | null {
  const [encodedPayload, signature, ...extra] = token.split('.');
  if (encodedPayload == null || signature == null || extra.length > 0) return null;
  if (!safeEqual(signature, sign(encodedPayload, secret))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<AdminSessionPayload>;
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      typeof payload.nonce !== 'string' ||
      payload.nonce.length < 32 ||
      payload.iat > now + CLOCK_SKEW_SECONDS ||
      payload.exp <= now ||
      payload.exp - payload.iat > SESSION_DURATION_SECONDS + CLOCK_SKEW_SECONDS
    ) {
      return null;
    }
    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}

export function verifySyncAdminSecret(candidate: string): boolean {
  const secret = syncSecret();
  return secret != null && candidate !== '' && safeEqual(candidate, secret);
}

export function validSyncAdminSession(cookieValue: string | undefined): boolean {
  const secret = syncSecret();
  return secret != null && cookieValue != null && parseSession(cookieValue, secret) != null;
}

export function createSyncAdminSession(): string | null {
  const secret = syncSecret();
  if (secret == null) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
    nonce: randomBytes(24).toString('base64url'),
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}
