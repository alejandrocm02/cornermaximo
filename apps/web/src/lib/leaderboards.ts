/**
 * Rankings agregados de las ligas de clubes (excluye competiciones de selecciones),
 * agrupando por el club actual del jugador. Usado en la home.
 */
import { prisma } from '@futstats/db';

const FIELD_METRICS = { goals: 'goals', assists: 'assists' } as const;
const GK_METRICS = { saves: 'saves' } as const;

export type LeaderboardMetric = keyof typeof FIELD_METRICS | keyof typeof GK_METRICS;

export interface LeaderRow {
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  total: number;
}

interface RawRow { slug: string; name: string; photoUrl: string | null; team: string | null; total: bigint }

export async function topLeaguePlayers(metric: LeaderboardMetric, limit = 5): Promise<LeaderRow[]> {
  const isGk = metric in GK_METRICS;
  const column = isGk ? GK_METRICS[metric as keyof typeof GK_METRICS] : FIELD_METRICS[metric as keyof typeof FIELD_METRICS];
  const table = isGk ? '"GoalkeeperMatchStatistics"' : '"PlayerMatchStatistics"';

  const rows = await prisma.$queryRawUnsafe<RawRow[]>(
    `
    SELECT p.slug,
           COALESCE(p."knownAs", p."fullName") AS name,
           p."photoUrl" AS "photoUrl",
           t.name AS team,
           SUM(s.${column}) AS total
    FROM ${table} s
    JOIN "MatchPlayer" mp ON mp.id = s."matchPlayerId"
    JOIN "Player" p       ON p.id = mp."playerId"
    LEFT JOIN "Team" t    ON t.id = p."currentTeamId"
    JOIN "Match" m        ON m.id = mp."matchId"
    JOIN "Season" se      ON se.id = m."seasonId"
    JOIN "Competition" c  ON c.id = se."competitionId"
    WHERE c.type = 'LEAGUE' AND s.${column} IS NOT NULL
    GROUP BY p.slug, p."knownAs", p."fullName", p."photoUrl", t.name
    ORDER BY total DESC
    LIMIT $1
    `,
    limit,
  );

  return rows.map((r) => ({ ...r, total: Number(r.total) }));
}
