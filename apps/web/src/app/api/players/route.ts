/**
 * GET /api/players — búsqueda y filtros con paginación.
 * ?q= texto | league= slug | team= slug | position= GK/DF/MF/FW
 * ?nationality= | minAge= | maxAge= | page= | pageSize=
 */
import { prisma, type Prisma } from '@cornermaximo/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  league: z.string().trim().max(50).optional(),
  team: z.string().trim().max(60).optional(),
  position: z.enum(['GK', 'DF', 'MF', 'FW']).optional(),
  nationality: z.string().trim().max(50).optional(),
  minAge: z.coerce.number().int().min(14).max(50).optional(),
  maxAge: z.coerce.number().int().min(14).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return jsonError(422, 'INVALID_QUERY', parsed.error.issues.map((i) => i.message).join('; '));
  }
  const { q, league, team, position, nationality, minAge, maxAge, page, pageSize } = parsed.data;

  const now = new Date();
  const birthBefore = minAge != null ? new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate()) : undefined;
  const birthAfter = maxAge != null ? new Date(now.getFullYear() - maxAge - 1, now.getMonth(), now.getDate()) : undefined;

  const where: Prisma.PlayerWhereInput = {
    ...(q != null && q !== ''
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { knownAs: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(team != null || league != null
      ? {
          currentTeam: {
            ...(team != null ? { slug: team } : {}),
            ...(league != null
              ? { seasons: { some: { season: { competition: { slug: league }, isCurrent: true } } } }
              : {}),
          },
        }
      : {}),
    ...(position != null ? { positions: { some: { group: position, isPrimary: true } } } : {}),
    ...(nationality != null ? { nationality: { name: { contains: nationality, mode: 'insensitive' } } } : {}),
    ...(birthBefore != null || birthAfter != null
      ? { birthDate: { ...(birthBefore != null ? { lte: birthBefore } : {}), ...(birthAfter != null ? { gte: birthAfter } : {}) } }
      : {}),
  };

  const [total, players] = await Promise.all([
    prisma.player.count({ where }),
    prisma.player.findMany({
      where,
      include: {
        currentTeam: { select: { name: true, slug: true, crestUrl: true } },
        positions: { where: { isPrimary: true } },
        nationality: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    page,
    pageSize,
    total,
    results: players.map((p) => ({
      slug: p.slug,
      name: p.knownAs ?? p.fullName,
      photoUrl: p.photoUrl,
      team: p.currentTeam?.name ?? null,
      teamSlug: p.currentTeam?.slug ?? null,
      crestUrl: p.currentTeam?.crestUrl ?? null,
      position: p.positions[0]?.group ?? null,
      nationality: p.nationality?.name ?? null,
      status: p.status,
    })),
  });
}
