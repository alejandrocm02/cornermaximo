/**
 * GET /api/rankings?metric=goals&scope=season|last5&position=&league=&limit=
 * Métricas en lista blanca -> SQL raw seguro (el nombre de columna nunca viene del usuario).
 */
import { prisma } from '@futstats/db';
import { CURRENT_SEASON } from '@futstats/shared';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const FIELD_METRICS = {
  goals: 'goals',
  assists: 'assists',
  shotsOnTarget: '"shotsOnTarget"',
  keyPasses: '"keyPasses"',
  tacklesWon: '"tacklesWon"',
  interceptions: 'interceptions',
  foulsDrawn: '"foulsDrawn"',
  yellowCards: '"yellowCards"',
} as const;

const GK_METRICS = {
  saves: 'saves',
  goalsConceded: '"goalsConceded"',
  penaltiesSaved: '"penaltiesSaved"',
} as const;

const querySchema = z.object({
  metric: z.enum([
    ...(Object.keys(FIELD_METRICS) as [keyof typeof FIELD_METRICS]),
    ...(Object.keys(GK_METRICS) as [keyof typeof GK_METRICS]),
  ]),
  league: z.string().trim().max(50).optional(),
  season: z.coerce.number().int().min(2000).max(2100).default(CURRENT_SEASON),
  position: z.enum(['GK', 'DF', 'MF', 'FW']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

interface Row {
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  total: bigint;
  minutes: bigint;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return jsonError(422, 'INVALID_QUERY', parsed.error.issues.map((i) => i.message).join('; '));
  }
  const { metric, league, season, position, limit } = parsed.data;

  const isGk = metric in GK_METRICS;
  const column = isGk
    ? GK_METRICS[metric as keyof typeof GK_METRICS]
    : FIELD_METRICS[metric as keyof typeof FIELD_METRICS];
  const table = isGk ? '"GoalkeeperMatchStatistics"' : '"PlayerMatchStatistics"';

  // Filtros dinámicos parametrizados
  const conditions: string[] = [`s.${column} IS NOT NULL`];
  const params: unknown[] = [];
  if (league != null) {
    params.push(league);
    conditions.push(`c.slug = $${params.length}`);
  }
  params.push(season);
  conditions.push(`se.year = $${params.length}`);
  if (position != null) {
    params.push(position);
    conditions.push(
      `EXISTS (SELECT 1 FROM "PlayerPosition" pp WHERE pp."playerId" = p.id AND pp."isPrimary" = true AND pp."group" = $${params.length}::"PositionGroup")`,
    );
  }
  params.push(limit);

  const sql = `
    SELECT p.slug,
           COALESCE(p."knownAs", p."fullName") AS name,
           p."photoUrl"                        AS "photoUrl",
           t.name                              AS team,
           SUM(s.${column})                    AS total,
           SUM(mp."minutesPlayed")             AS minutes
    FROM ${table} s
    JOIN "MatchPlayer" mp ON mp.id = s."matchPlayerId"
    JOIN "Player" p       ON p.id = mp."playerId"
    LEFT JOIN "Team" t    ON t.id = p."currentTeamId"
    JOIN "Match" m        ON m.id = mp."matchId"
    JOIN "Season" se      ON se.id = m."seasonId"
    JOIN "Competition" c  ON c.id = se."competitionId"
    WHERE ${conditions.join(' AND ')}
    GROUP BY p.slug, p."knownAs", p."fullName", p."photoUrl", t.name
    ORDER BY total DESC
    LIMIT $${params.length}
  `;

  const rows = await prisma.$queryRawUnsafe<Row[]>(sql, ...params);

  return NextResponse.json({
    metric,
    results: rows.map((r, i) => ({
      rank: i + 1,
      slug: r.slug,
      name: r.name,
      photoUrl: r.photoUrl,
      team: r.team,
      total: Number(r.total),
      minutes: Number(r.minutes),
    })),
  });
}
