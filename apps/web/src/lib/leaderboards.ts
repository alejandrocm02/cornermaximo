import { prisma } from '@futstats/db';

type MetricSource = 'field' | 'gk';

export type LeaderboardMetric = {
  key: string;
  label: string;
  source: MetricSource;
  column: string;
};

export type LeaderboardRow = {
  rank: number;
  slug: string;
  name: string;
  team: string | null;
  total: number;
  minutes: number;
};

export const FIELD_LEADERBOARD_METRICS: LeaderboardMetric[] = [
  { key: 'goals', label: 'Goles', source: 'field', column: 'goals' },
  { key: 'assists', label: 'Asistencias', source: 'field', column: 'assists' },
  { key: 'shotsOnTarget', label: 'Tiros a puerta', source: 'field', column: '"shotsOnTarget"' },
  { key: 'keyPasses', label: 'Pases clave', source: 'field', column: '"keyPasses"' },
  { key: 'tacklesAttempted', label: 'Entradas', source: 'field', column: '"tacklesAttempted"' },
  { key: 'interceptions', label: 'Intercepciones', source: 'field', column: 'interceptions' },
  { key: 'duelsWon', label: 'Duelos ganados', source: 'field', column: '"duelsWon"' },
  { key: 'yellowCards', label: 'Amarillas', source: 'field', column: '"yellowCards"' },
];

export const GK_LEADERBOARD_METRICS: LeaderboardMetric[] = [
  { key: 'saves', label: 'Paradas', source: 'gk', column: 'saves' },
  { key: 'goalsConceded', label: 'Goles encajados', source: 'gk', column: '"goalsConceded"' },
  { key: 'penaltiesSaved', label: 'Penaltis parados', source: 'gk', column: '"penaltiesSaved"' },
];

export const ALL_LEADERBOARD_METRICS = [...FIELD_LEADERBOARD_METRICS, ...GK_LEADERBOARD_METRICS];

export async function getCompetitionLeaderboard(
  competitionSlug: string,
  season: number,
  metric: LeaderboardMetric,
  limit = 8,
): Promise<LeaderboardRow[]> {
  const table = metric.source === 'gk' ? '"GoalkeeperMatchStatistics"' : '"PlayerMatchStatistics"';
  const rows = await prisma.$queryRawUnsafe<
    Array<{ slug: string; name: string; team: string | null; total: bigint; minutes: bigint }>
  >(
    `
      SELECT p.slug,
             COALESCE(p."knownAs", p."fullName") AS name,
             t.name                              AS team,
             SUM(s.${metric.column})             AS total,
             SUM(mp."minutesPlayed")             AS minutes
      FROM ${table} s
      JOIN "MatchPlayer" mp ON mp.id = s."matchPlayerId"
      JOIN "Player" p       ON p.id = mp."playerId"
      LEFT JOIN "Team" t    ON t.id = mp."teamId"
      JOIN "Match" m        ON m.id = mp."matchId"
      JOIN "Season" se      ON se.id = m."seasonId"
      JOIN "Competition" c  ON c.id = se."competitionId"
      WHERE c.slug = $1
        AND se.year = $2
        AND s.${metric.column} IS NOT NULL
      GROUP BY p.slug, p."knownAs", p."fullName", t.name
      ORDER BY total DESC, minutes ASC
      LIMIT $3
    `,
    competitionSlug,
    season,
    limit,
  );

  return rows.map((row, index) => ({
    rank: index + 1,
    slug: row.slug,
    name: row.name,
    team: row.team,
    total: Number(row.total),
    minutes: Number(row.minutes),
  }));
}
