import { prisma } from '@cornermaximo/db';
import {
  buildPlayerIntelligenceSignals,
  buildTeamIntelligenceSignals,
  type IntelligenceSignal,
  type PlayerIntelligenceSample,
  type TeamIntelligenceSample,
} from '@cornermaximo/stats';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG, FOOTBALL_DATA_REVALIDATE_SECONDS } from './cache';

export interface EntityIntelligenceSignal extends IntelligenceSignal {
  entityId: number;
  entityName: string;
  entitySlug: string;
  entityType: 'TEAM' | 'PLAYER';
  entityHref: string;
  context: string | null;
}

interface TeamSampleRow extends TeamIntelligenceSample {
  teamId: number;
  teamName: string;
  teamSlug: string;
  competitionName: string;
  kickoffAt: Date;
}

interface PlayerSampleRow extends PlayerIntelligenceSample {
  playerId: number;
  playerName: string;
  playerSlug: string;
  teamName: string | null;
  competitionName: string;
  kickoffAt: Date;
}

function byEntity<T>(rows: T[], getId: (row: T) => number): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const row of rows) {
    const id = getId(row);
    const current = groups.get(id);
    if (current) current.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}

function rankSignals(signals: EntityIntelligenceSignal[]): EntityIntelligenceSignal[] {
  return signals.sort(
    (a, b) =>
      b.consistencyScore - a.consistencyScore ||
      b.hitRate - a.hitRate ||
      b.sampleSize - a.sampleSize ||
      a.entityName.localeCompare(b.entityName),
  );
}

const getTeamSignalsCached = unstable_cache(
  async (): Promise<EntityIntelligenceSignal[]> => {
    const rows = await prisma.$queryRaw<TeamSampleRow[]>`
      WITH ranked AS (
        SELECT
          mt."teamId" AS "teamId",
          t.name AS "teamName",
          t.slug AS "teamSlug",
          c.name AS "competitionName",
          m."kickoffAt" AS "kickoffAt",
          mt.goals AS "ownGoals",
          opp.goals AS "opponentGoals",
          ROW_NUMBER() OVER (
            PARTITION BY mt."teamId"
            ORDER BY m."kickoffAt" DESC, m.id DESC
          ) AS rn
        FROM "Match" m
        JOIN "Season" se ON se.id = m."seasonId"
        JOIN "Competition" c ON c.id = se."competitionId"
        JOIN "MatchTeam" mt ON mt."matchId" = m.id
        JOIN "MatchTeam" opp ON opp."matchId" = m.id AND opp."teamId" <> mt."teamId"
        JOIN "Team" t ON t.id = mt."teamId"
        WHERE m.status = 'FINISHED'
          AND se."isCurrent" = TRUE
          AND mt.goals IS NOT NULL
          AND opp.goals IS NOT NULL
      )
      SELECT
        "teamId",
        "teamName",
        "teamSlug",
        "competitionName",
        "kickoffAt",
        "ownGoals",
        "opponentGoals"
      FROM ranked
      WHERE rn <= 10
      ORDER BY "teamId", "kickoffAt" DESC
    `;

    const signals: EntityIntelligenceSignal[] = [];
    for (const [teamId, samples] of byEntity(rows, (row) => row.teamId)) {
      const latest = samples[0];
      if (!latest) continue;
      const entitySignals = buildTeamIntelligenceSignals(samples);
      for (const signal of entitySignals) {
        signals.push({
          ...signal,
          entityId: teamId,
          entityName: latest.teamName,
          entitySlug: latest.teamSlug,
          entityType: 'TEAM',
          entityHref: `/equipos/${latest.teamSlug}`,
          context: latest.competitionName,
        });
      }
    }

    return rankSignals(signals).slice(0, 120);
  },
  ['cm-intelligence-team-signals-v1'],
  { revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS, tags: [FOOTBALL_DATA_CACHE_TAG] },
);

const getPlayerSignalsCached = unstable_cache(
  async (): Promise<EntityIntelligenceSignal[]> => {
    const rows = await prisma.$queryRaw<PlayerSampleRow[]>`
      WITH ranked AS (
        SELECT
          mp."playerId" AS "playerId",
          COALESCE(p."knownAs", p."fullName") AS "playerName",
          p.slug AS "playerSlug",
          team.name AS "teamName",
          c.name AS "competitionName",
          m."kickoffAt" AS "kickoffAt",
          pms.goals AS goals,
          pms.assists AS assists,
          pms."shotsTotal" AS "shotsTotal",
          pms."shotsOnTarget" AS "shotsOnTarget",
          pms."keyPasses" AS "keyPasses",
          pms."tacklesWon" AS "tacklesWon",
          pms."foulsCommitted" AS "foulsCommitted",
          ROW_NUMBER() OVER (
            PARTITION BY mp."playerId"
            ORDER BY m."kickoffAt" DESC, m.id DESC
          ) AS rn
        FROM "MatchPlayer" mp
        JOIN "Match" m ON m.id = mp."matchId"
        JOIN "Season" se ON se.id = m."seasonId"
        JOIN "Competition" c ON c.id = se."competitionId"
        JOIN "Player" p ON p.id = mp."playerId"
        LEFT JOIN "Team" team ON team.id = p."currentTeamId"
        JOIN "PlayerMatchStatistics" pms ON pms."matchPlayerId" = mp.id
        WHERE m.status = 'FINISHED'
          AND se."isCurrent" = TRUE
          AND mp."minutesPlayed" > 0
      )
      SELECT
        "playerId",
        "playerName",
        "playerSlug",
        "teamName",
        "competitionName",
        "kickoffAt",
        goals,
        assists,
        "shotsTotal",
        "shotsOnTarget",
        "keyPasses",
        "tacklesWon",
        "foulsCommitted"
      FROM ranked
      WHERE rn <= 10
      ORDER BY "playerId", "kickoffAt" DESC
    `;

    const signals: EntityIntelligenceSignal[] = [];
    for (const [playerId, samples] of byEntity(rows, (row) => row.playerId)) {
      const latest = samples[0];
      if (!latest) continue;
      const entitySignals = buildPlayerIntelligenceSignals(samples);
      for (const signal of entitySignals) {
        signals.push({
          ...signal,
          entityId: playerId,
          entityName: latest.playerName,
          entitySlug: latest.playerSlug,
          entityType: 'PLAYER',
          entityHref: `/jugadores/${latest.playerSlug}`,
          context: latest.teamName ?? latest.competitionName,
        });
      }
    }

    return rankSignals(signals).slice(0, 120);
  },
  ['cm-intelligence-player-signals-v1'],
  { revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS, tags: [FOOTBALL_DATA_CACHE_TAG] },
);

export async function getIntelligenceSnapshot() {
  const [teamSignals, playerSignals] = await Promise.all([
    getTeamSignalsCached(),
    getPlayerSignalsCached(),
  ]);

  return {
    teamSignals,
    playerSignals,
    generatedAt: new Date(),
  };
}
