/**
 * @cornermaximo/db — cliente Prisma singleton.
 * Evita agotar conexiones en desarrollo (hot reload de Next.js).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { normalizeDatabaseUrl } from './connection-url';

function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error('DATABASE_URL es obligatoria para inicializar Prisma.');
  }
  return normalizeDatabaseUrl(value);
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireDatabaseUrl() }),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from './generated/prisma/client';
