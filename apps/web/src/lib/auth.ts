import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { prisma } from '@futstats/db';
import { cookies } from 'next/headers';

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = 'futstats_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
const SCRYPT_N = 131_072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;

export interface AuthUser {
  id: number;
  email: string;
  role: 'USER' | 'ANALYST' | 'ADMIN';
}

interface SessionPayload {
  userId: number;
  expiresAt: number;
  nonce: string;
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret == null || secret.length < 32) {
    throw new Error('AUTH_SECRET debe contener al menos 32 caracteres.');
  }
  return secret;
}

function encode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', authSecret()).update(encodedPayload).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 256 * 1024 * 1024,
  })) as Buffer;
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, encode(salt), encode(derived)].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, nValue, rValue, pValue, saltValue, hashValue] = stored.split('$');
  if (
    algorithm !== 'scrypt' ||
    nValue == null || rValue == null || pValue == null ||
    saltValue == null || hashValue == null
  ) return false;

  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (!Number.isSafeInteger(N) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p)) return false;

  try {
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = (await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length, {
      N,
      r,
      p,
      maxmem: 256 * 1024 * 1024,
    })) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createSession(userId: number): Promise<void> {
  const payload: SessionPayload = {
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
    nonce: randomBytes(16).toString('hex'),
  };
  const encodedPayload = encode(JSON.stringify(payload));
  const token = `${encodedPayload}.${sign(encodedPayload)}`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

function decodeSession(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split('.');
  if (encodedPayload == null || signature == null || !safeEqual(sign(encodedPayload), signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    if (
      !Number.isSafeInteger(payload.userId) ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Math.floor(Date.now() / 1000) ||
      typeof payload.nonce !== 'string'
    ) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token == null) return null;
  const session = decodeSession(token);
  if (session == null) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true },
  });
  if (user == null) return null;
  return { id: user.id, email: user.email, role: String(user.role) as AuthUser['role'] };
}

export function requestFingerprint(ip: string, email: string): string {
  return createHash('sha256').update(`${ip}|${normalizeEmail(email)}|${authSecret()}`).digest('hex');
}
