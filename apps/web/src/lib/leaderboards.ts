/**
 * Rankings y leaderboards de CornerMaximo.
 *
 * Regla de producto: cualquier ranking sin temporada explícita representa la
 * temporada vigente. El histórico solo entra cuando el usuario selecciona una
 * temporada concreta.
 */
import { prisma } from '@cornermaximo/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG, FOOTBALL_DATA_REVALIDATE_SECONDS } from '@/lib/cache';

const HOME_FIELD_METRICS = { goals: 'goals', assists: 'assists' } as const;
const HOME_GK_METRICS = { saves: 'saves' } as const;

export type LeaderboardMetric = keyof typeof HOME_FIELD_METRICS | keyof typeof HOME_GK_METRICS;

export interface LeaderRow {
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  total: number;
}

interface RawLeaderRow {
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  total: bigint | number | string;
}

async function queryTopLeaguePlayers(metric: LeaderboardMetric, limit: number): Promise<LeaderRow[]> {
  const isGk = metric in HOME_GK_METRICS;
  const column = isGk
    ? HOME_GK_METRICS[metric as keyof typeof HOME_GK_METRICS]
    : HOME_FIELD_METRICS[metric as keyof typeof HOME_FIELD_METRICS];
  const table = isGk ? '"GoalkeeperMatchStatistics"' : '"PlayerMatchStatistics"';

  const rows = await prisma.$queryRawUnsafe<RawLeaderRow[]>(
    `
    SELECT p.slug,
           COALESCE(p."knownAs", p."fullName") AS name,
           p."photoUrl" AS "photoUrl",
           t.name AS team,
           SUM(s.${column}) AS total
    FROM ${table} s
    JOIN "MatchPlayer" mp ON mp.id = s."matchPlayerId"
    JOIN "Player" p       ON p.id = mp."playerId"
    LEFT JOIN "Team" t    ON t.id = mp."teamId"
    JOIN "Match" m        ON m.id = mp."matchId"
    JOIN "Season" se      ON se.id = m."seasonId"
    JOIN "Competition" c  ON c.id = se."competitionId"
    WHERE c.type = 'LEAGUE'
      AND se."isCurrent" = true
      AND m.status = 'FINISHED'
      AND s.${column} IS NOT NULL
    GROUP BY p.slug, p."knownAs", p."fullName", p."photoUrl", t.name
    ORDER BY total DESC, name ASC
    LIMIT $1
    `,
    limit,
  );

  return rows.map((row) => ({ ...row, total: Number(row.total) }));
}

const cachedTopLeaguePlayers = unstable_cache(queryTopLeaguePlayers, ['top-league-players-current-v2'], {
  revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG, 'leaderboards'],
});

export async function topLeaguePlayers(metric: LeaderboardMetric, limit = 5): Promise<LeaderRow[]> {
  return cachedTopLeaguePlayers(metric, limit);
}

// --- Centro de rankings -------------------------------------------------------

type RankingDefinition = {
  source: 'field' | 'gk' | 'matchPlayer';
  expression: string;
  presentCondition: string;
  decimals?: number;
};

const RANKING_DEFINITIONS: Record<string, RankingDefinition> = {
  goals: { source: 'field', expression: 'SUM(s.goals)', presentCondition: 's.goals IS NOT NULL' },
  assists: { source: 'field', expression: 'SUM(s.assists)', presentCondition: 's.assists IS NOT NULL' },
  shotsOnTarget: { source: 'field', expression: 'SUM(s."shotsOnTarget")', presentCondition: 's."shotsOnTarget" IS NOT NULL' },
  keyPasses: { source: 'field', expression: 'SUM(s."keyPasses")', presentCondition: 's."keyPasses" IS NOT NULL' },
  tackles: { source: 'field', expression: 'SUM(s."tacklesAttempted")', presentCondition: 's."tacklesAttempted" IS NOT NULL' },
  interceptions: { source: 'field', expression: 'SUM(s.interceptions)', presentCondition: 's.interceptions IS NOT NULL' },
  foulsCommitted: { source: 'field', expression: 'SUM(s."foulsCommitted")', presentCondition: 's."foulsCommitted" IS NOT NULL' },
  foulsDrawn: { source: 'field', expression: 'SUM(s."foulsDrawn")', presentCondition: 's."foulsDrawn" IS NOT NULL' },
  yellowCards: { source: 'field', expression: 'SUM(s."yellowCards")', presentCondition: 's."yellowCards" IS NOT NULL' },
  saves: { source: 'gk', expression: 'SUM(s.saves)', presentCondition: 's.saves IS NOT NULL' },
  cleanSheets: { source: 'gk', expression: 'SUM(CASE WHEN s."cleanSheet" = true THEN 1 ELSE 0 END)', presentCondition: 's."cleanSheet" IS NOT NULL' },
  rating: { source: 'matchPlayer', expression: 'AVG(mp.rating)', presentCondition: 'mp.rating IS NOT NULL', decimals: 2 },
  minutes: { source: 'matchPlayer', expression: 'SUM(mp."minutesPlayed")', presentCondition: 'mp."minutesPlayed" > 0' },
};

export type RankingMetric =
  | 'goals'
  | 'assists'
  | 'shotsOnTarget'
  | 'keyPasses'
  | 'tackles'
  | 'interceptions'
  | 'foulsCommitted'
  | 'foulsDrawn'
  | 'yellowCards'
  | 'saves'
  | 'cleanSheets'
  | 'rating'
  | 'minutes';

export const RANKING_METRICS: RankingMetric[] = [
  'goals',
  'assists',
  'shotsOnTarget',
  'keyPasses',
  'tackles',
  'interceptions',
  'foulsCommitted',
  'foulsDrawn',
  'yellowCards',
  'saves',
  'cleanSheets',
  'rating',
  'minutes',
];

export interface RankingRow extends LeaderRow {
  minutes: number;
  appearances: number;
  position: string | null;
}

async function queryRankingRows(
  metric: RankingMetric,
  league: string,
  season: number | null,
  position: string,
  limit: number,
): Promise<RankingRow[]> {
  const definition = RANKING_DEFINITIONS[metric]!;
  const params: unknown[] = [];
  const conditions = [`c.type = 'LEAGUE'`, `m.status = 'FINISHED'`, definition.presentCondition];

  if (league !== '') {
    params.push(league);
    conditions.push(`c.slug = $${params.length}`);
  }
  if (season != null) {
    params.push(season);
    conditions.push(`se.year = $${params.length}`);
  } else {
    conditions.push(`se."isCurrent" = true`);
  }
  if (position !== '') {
    params.push(position);
    conditions.push(`EXISTS (
      SELECT 1 FROM "PlayerPosition" selected_position
      WHERE selected_position."playerId" = p.id
        AND selected_position."isPrimary" = true
        AND selected_position."group" = $${params.length}::"PositionGroup"
    )`);
  }
  params.push(limit);

  const statsJoin = definition.source === 'field'
    ? 'JOIN "PlayerMatchStatistics" s ON s."matchPlayerId" = mp.id'
    : definition.source === 'gk'
      ? 'JOIN "GoalkeeperMatchStatistics" s ON s."matchPlayerId" = mp.id'
      : '';

  const rows = await prisma.$queryRawUnsafe<Array<RawLeaderRow & {
    minutes: bigint;
    appearances: bigint;
    position: string | null;
  }>>(
    `
    SELECT p.slug,
           COALESCE(p."knownAs", p."fullName") AS name,
           p."photoUrl" AS "photoUrl",
           t.name AS team,
           ${definition.expression} AS total,
           SUM(mp."minutesPlayed")::bigint AS minutes,
           COUNT(DISTINCT mp.id)::bigint AS appearances,
           (SELECT pp."group"::text
              FROM "PlayerPosition" pp
             WHERE pp."playerId" = p.id AND pp."isPrimary" = true
             LIMIT 1) AS position
    FROM "MatchPlayer" mp
    ${statsJoin}
    JOIN "Player" p       ON p.id = mp."playerId"
    LEFT JOIN "Team" t    ON t.id = mp."teamId"
    JOIN "Match" m        ON m.id = mp."matchId"
    JOIN "Season" se      ON se.id = m."seasonId"
    JOIN "Competition" c  ON c.id = se."competitionId"
    WHERE ${conditions.join(' AND ')}
    GROUP BY p.id, p.slug, p."knownAs", p."fullName", p."photoUrl", t.name
    ORDER BY total DESC NULLS LAST, minutes DESC, name ASC
    LIMIT $${params.length}
    `,
    ...params,
  );

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    photoUrl: row.photoUrl,
    team: row.team,
    total: Number(Number(row.total).toFixed(definition.decimals ?? 0)),
    minutes: Number(row.minutes),
    appearances: Number(row.appearances),
    position: row.position,
  }));
}

const cachedRankingRows = unstable_cache(queryRankingRows, ['ranking-rows-v3'], {
  revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG, 'leaderboards'],
});

export async function rankingRows(options: {
  metric: RankingMetric;
  league?: string;
  season?: number;
  position?: string;
  limit?: number;
}): Promise<RankingRow[]> {
  const { metric, league = '', season = null, position = '', limit = 50 } = options;
  return cachedRankingRows(metric, league, season, position, limit);
}
