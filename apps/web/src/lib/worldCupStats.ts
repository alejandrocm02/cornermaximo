/**
 * Estadísticas individuales agregadas para una competición concreta (usado por
 * la sección Mundial 2026, pero funciona para cualquier competición por slug).
 *
 * A diferencia de /api/rankings (que agrupa por el CLUB ACTUAL del jugador, una
 * simplificación válida cuando se listan varias competiciones a la vez), aquí
 * agrupamos por el equipo con el que jugó CADA partido de esta competición. En
 * una competición de selecciones eso es siempre la selección nacional, nunca el
 * club — lo correcto para un ranking de goleadores del Mundial.
 */
import { prisma } from '@futstats/db';

const FIELD_METRICS = {
  goals: 'goals',
  assists: 'assists',
  yellowCards: '"yellowCards"',
  redCards: '"redCards"',
  shotsOnTarget: '"shotsOnTarget"',
  keyPasses: '"keyPasses"',
  dribblesCompleted: '"dribblesCompleted"',
  tacklesWon: '"tacklesWon"',
  interceptions: 'interceptions',
} as const;

const GK_METRICS = {
  saves: 'saves',
  goalsConceded: '"goalsConceded"',
  penaltiesSaved: '"penaltiesSaved"',
} as const;

export type WorldCupStatMetric = keyof typeof FIELD_METRICS | keyof typeof GK_METRICS;

export interface TopStatRow {
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  teamSlug: string | null;
  total: number;
  minutes: number;
}

interface RawRow {
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  teamSlug: string | null;
  total: bigint;
  minutes: bigint;
}

export async function topPlayerStat(
  competitionSlug: string,
  metric: WorldCupStatMetric,
  limit = 10,
): Promise<TopStatRow[]> {
  const isGk = metric in GK_METRICS;
  const column = isGk
    ? GK_METRICS[metric as keyof typeof GK_METRICS]
    : FIELD_METRICS[metric as keyof typeof FIELD_METRICS];
  const table = isGk ? '"GoalkeeperMatchStatistics"' : '"PlayerMatchStatistics"';

  const rows = await prisma.$queryRawUnsafe<RawRow[]>(
    `
    SELECT p.slug,
           COALESCE(p."knownAs", p."fullName") AS name,
           p."photoUrl"                        AS "photoUrl",
           t.name                              AS team,
           t.slug                              AS "teamSlug",
           SUM(s.${column})                    AS total,
           SUM(mp."minutesPlayed")             AS minutes
    FROM ${table} s
    JOIN "MatchPlayer" mp ON mp.id = s."matchPlayerId"
    JOIN "Player" p       ON p.id = mp."playerId"
    JOIN "Team" t         ON t.id = mp."teamId"
    JOIN "Match" m        ON m.id = mp."matchId"
    JOIN "Season" se      ON se.id = m."seasonId"
    JOIN "Competition" c  ON c.id = se."competitionId"
    WHERE c.slug = $1 AND s.${column} IS NOT NULL
    GROUP BY p.slug, p."knownAs", p."fullName", p."photoUrl", t.name, t.slug
    ORDER BY total DESC
    LIMIT $2
    `,
    competitionSlug,
    limit,
  );

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    photoUrl: r.photoUrl,
    team: r.team,
    teamSlug: r.teamSlug,
    total: Number(r.total),
    minutes: Number(r.minutes),
  }));
}
