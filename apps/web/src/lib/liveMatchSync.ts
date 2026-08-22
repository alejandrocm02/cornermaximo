import 'server-only';

import { prisma, type EventType } from '@cornermaximo/db';
import {
  ApiFootballClient,
  ApiFootballProvider,
  mapFixture,
} from '@cornermaximo/providers';
import { PrismaBudgetGuard, syncMatchStats } from '@cornermaximo/sync';

const CORE_RUN_LIMIT = 8;
const DETAIL_RUN_LIMIT = 8;

interface RawFixtureEvent {
  time: { elapsed: number | null; extra: number | null };
  team: { id: number; name?: string | null };
  player: { id: number | null; name: string | null } | null;
  assist: { id: number | null; name: string | null } | null;
  type: string;
  detail: string | null;
  comments: string | null;
}

interface RawFixtureStatus {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed?: number | null; extra?: number | null };
  };
  league: { id: number; season: number; round: string | null };
  teams: { home: { id: number }; away: { id: number } };
  goals: { home: number | null; away: number | null };
  score: {
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface LiveCoreSnapshot {
  status: string;
  elapsed: number | null;
  extra: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  eventCount: number;
  terminal: boolean;
  refreshedAt: string;
}

function terminalStatus(status: string): boolean {
  return ['FINISHED', 'POSTPONED', 'SUSPENDED', 'ABANDONED', 'CANCELLED'].includes(status);
}

function mapEventType(type: string, detail: string | null): EventType | null {
  const normalizedType = type.toLowerCase();
  const normalizedDetail = (detail ?? '').toLowerCase();

  if (normalizedType === 'goal') {
    if (normalizedDetail.includes('missed penalty')) return 'MISSED_PENALTY';
    if (normalizedDetail.includes('own goal')) return 'OWN_GOAL';
    if (normalizedDetail.includes('penalty')) return 'PENALTY_GOAL';
    return 'GOAL';
  }
  if (normalizedType === 'card') {
    if (normalizedDetail.includes('second yellow')) return 'SECOND_YELLOW';
    if (normalizedDetail.includes('red')) return 'RED_CARD';
    return 'YELLOW_CARD';
  }
  if (normalizedType === 'subst' || normalizedType === 'substitution') return 'SUBSTITUTION';
  if (normalizedType === 'var') return 'VAR';
  return null;
}

async function createClient(providerDbId: number, runLimit: number): Promise<ApiFootballClient> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error('Falta API_FOOTBALL_KEY');
  const dailyLimit = Number(process.env.API_FOOTBALL_DAILY_LIMIT ?? 7_500);
  const budget = new PrismaBudgetGuard(prisma, providerDbId, dailyLimit, runLimit);
  return new ApiFootballClient({
    apiKey,
    baseUrl: process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io',
    budget,
    minIntervalMs:
      process.env.API_FOOTBALL_MIN_INTERVAL_MS != null
        ? Number(process.env.API_FOOTBALL_MIN_INTERVAL_MS)
        : undefined,
  });
}

export async function syncLiveMatchCore(matchId: number): Promise<LiveCoreSnapshot | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teams: {
        include: { team: { select: { externalId: true } } },
      },
    },
  });
  if (match == null) return null;

  const client = await createClient(match.providerId, CORE_RUN_LIMIT);
  const [fixtureRows, rawEvents] = await Promise.all([
    client.get<RawFixtureStatus>('/fixtures', { id: match.externalId }),
    client.get<RawFixtureEvent>('/fixtures/events', { fixture: match.externalId }),
  ]);
  const rawFixture = fixtureRows[0];
  if (rawFixture == null) return null;

  const fixture = mapFixture(rawFixture);
  const home = match.teams.find((entry) => entry.isHome);
  const away = match.teams.find((entry) => !entry.isHome);

  const externalPlayerIds = [
    ...new Set(
      rawEvents
        .flatMap((event) => [event.player?.id, event.assist?.id])
        .filter((value): value is number => value != null)
        .map(String),
    ),
  ];
  const players =
    externalPlayerIds.length === 0
      ? []
      : await prisma.player.findMany({
          where: { providerId: match.providerId, externalId: { in: externalPlayerIds } },
          select: { id: true, externalId: true },
        });
  const playerIdByExternal = new Map(players.map((player) => [player.externalId, player.id]));

  const events = rawEvents.flatMap((event) => {
    const eventType = mapEventType(event.type, event.detail);
    if (eventType == null || event.time.elapsed == null) return [];
    return [
      {
        matchId,
        teamExternalId: event.team?.id != null ? String(event.team.id) : null,
        playerId:
          event.player?.id != null ? (playerIdByExternal.get(String(event.player.id)) ?? null) : null,
        assistPlayerId:
          event.assist?.id != null ? (playerIdByExternal.get(String(event.assist.id)) ?? null) : null,
        type: eventType,
        minute: event.time.elapsed,
        extraMinute: event.time.extra ?? null,
        detail: [event.detail, event.comments].filter(Boolean).join(' · ') || null,
      },
    ];
  });

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: {
        status: fixture.status,
        kickoffAt: new Date(fixture.kickoffAt),
        round: fixture.round,
        hasExtraTime: fixture.hasExtraTime,
        hasPenalties: fixture.hasPenalties,
      },
    });

    if (home != null) {
      await tx.matchTeam.update({
        where: { matchId_isHome: { matchId, isHome: true } },
        data: { goals: fixture.homeGoals, penaltyGoals: fixture.homePenaltyGoals },
      });
    }
    if (away != null) {
      await tx.matchTeam.update({
        where: { matchId_isHome: { matchId, isHome: false } },
        data: { goals: fixture.awayGoals, penaltyGoals: fixture.awayPenaltyGoals },
      });
    }

    await tx.matchEvent.deleteMany({ where: { matchId } });
    if (events.length > 0) await tx.matchEvent.createMany({ data: events });
  });

  return {
    status: fixture.status,
    elapsed: rawFixture.fixture.status.elapsed ?? null,
    extra: rawFixture.fixture.status.extra ?? null,
    homeGoals: fixture.homeGoals,
    awayGoals: fixture.awayGoals,
    eventCount: events.length,
    terminal: terminalStatus(fixture.status),
    refreshedAt: new Date().toISOString(),
  };
}

export async function syncLiveMatchDetail(matchId: number): Promise<{ processed: number; terminal: boolean } | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, externalId: true, providerId: true, status: true },
  });
  if (match == null) return null;

  const client = await createClient(match.providerId, DETAIL_RUN_LIMIT);
  const provider = new ApiFootballProvider(client);
  const processed = await syncMatchStats(
    prisma,
    provider,
    match.providerId,
    match.id,
    match.externalId,
  );

  return { processed, terminal: terminalStatus(String(match.status)) };
}
