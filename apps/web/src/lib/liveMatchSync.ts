import 'server-only';

import { prisma } from '@cornermaximo/db';
import {
  ApiFootballClient,
  ApiFootballProvider,
  mapFixture,
  mapFixtureEvents,
  type RawFixtureEvent,
} from '@cornermaximo/providers';
import { PrismaBudgetGuard, replaceMatchEvents, syncMatchStats } from '@cornermaximo/sync';

const CORE_RUN_LIMIT = 8;
const DETAIL_RUN_LIMIT = 8;
const SCOREBOARD_RUN_LIMIT = 24;
const MAX_TERMINAL_PROBES = 8;
const CONTRACT_DAILY_LIMIT = 5_000;
const MAX_DAILY_USAGE_RATIO = 0.75;
const SAFE_DAILY_LIMIT = Math.floor(CONTRACT_DAILY_LIMIT * MAX_DAILY_USAGE_RATIO);

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

export interface LiveScoreboardResult {
  /** Partidos rastreados por CornerMaximo que están realmente en directo. */
  live: number;
  updated: number;
  terminalProbes: number;
  refreshedAt: string;
}

function terminalStatus(status: string): boolean {
  return ['FINISHED', 'POSTPONED', 'SUSPENDED', 'ABANDONED', 'CANCELLED'].includes(status);
}

async function createClient(providerDbId: number, runLimit: number): Promise<ApiFootballClient> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error('Falta API_FOOTBALL_KEY');
  const configured = Number(process.env.API_FOOTBALL_DAILY_LIMIT ?? SAFE_DAILY_LIMIT);
  // Límite global compartido: nunca más del 75% de 5.000 requests/día.
  // Se puede configurar un valor menor para reservar todavía más cuota.
  const dailyLimit = Number.isFinite(configured)
    ? Math.min(Math.max(1, configured), SAFE_DAILY_LIMIT)
    : SAFE_DAILY_LIMIT;
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

async function persistFixture(matchId: number, rawFixture: RawFixtureStatus): Promise<void> {
  const fixture = mapFixture(rawFixture);
  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data: {
        status: fixture.status,
        kickoffAt: new Date(fixture.kickoffAt),
        round: fixture.round,
        hasExtraTime: fixture.hasExtraTime,
        hasPenalties: fixture.hasPenalties,
      },
    }),
    prisma.matchTeam.update({
      where: { matchId_isHome: { matchId, isHome: true } },
      data: { goals: fixture.homeGoals, penaltyGoals: fixture.homePenaltyGoals },
    }),
    prisma.matchTeam.update({
      where: { matchId_isHome: { matchId, isHome: false } },
      data: { goals: fixture.awayGoals, penaltyGoals: fixture.awayPenaltyGoals },
    }),
  ]);
}

export async function syncLiveScoreboard(): Promise<LiveScoreboardResult> {
  const provider = await prisma.dataProvider.findUnique({ where: { name: 'api-football' } });
  if (provider == null) throw new Error('Proveedor api-football no inicializado');

  // Una única llamada trae todos los partidos live del proveedor. Después se
  // cruzan con nuestra BD para actualizar SOLO competiciones/partidos rastreados.
  const client = await createClient(provider.id, SCOREBOARD_RUN_LIMIT);
  const liveRows = await client.get<RawFixtureStatus>('/fixtures', { live: 'all' });
  const liveExternalIds = new Set(liveRows.map((row) => String(row.fixture.id)));

  const knownMatches =
    liveRows.length === 0
      ? []
      : await prisma.match.findMany({
          where: { providerId: provider.id, externalId: { in: [...liveExternalIds] } },
          select: { id: true, externalId: true },
        });
  const matchIdByExternal = new Map(knownMatches.map((match) => [match.externalId, match.id]));

  let updated = 0;
  for (const rawFixture of liveRows) {
    const matchId = matchIdByExternal.get(String(rawFixture.fixture.id));
    if (matchId == null) continue;
    await persistFixture(matchId, rawFixture);
    updated++;
  }

  // Un partido que acaba deja de aparecer en `live=all`. Sondeamos los
  // encuentros que nuestra BD todavía considera LIVE y que ya no están en la
  // respuesta para capturar FT/AET/PEN sin esperar al sync general. No se
  // limita por antigüedad: si una ejecución falla durante el cierre, el
  // siguiente scoreboard debe poder reparar el estado aunque sea al día
  // siguiente.
  const staleLive = await prisma.match.findMany({
    where: {
      providerId: provider.id,
      status: 'LIVE',
      externalId: { notIn: [...liveExternalIds] },
    },
    select: { id: true, externalId: true },
    orderBy: { kickoffAt: 'asc' },
    take: MAX_TERMINAL_PROBES,
  });

  let terminalProbes = 0;
  for (const match of staleLive) {
    const rows = await client.get<RawFixtureStatus>('/fixtures', { id: match.externalId });
    const rawFixture = rows[0];
    if (rawFixture == null) continue;
    await persistFixture(match.id, rawFixture);
    terminalProbes++;
    updated++;
  }

  return {
    live: knownMatches.length,
    updated,
    terminalProbes,
    refreshedAt: new Date().toISOString(),
  };
}

export async function syncLiveMatchCore(matchId: number): Promise<LiveCoreSnapshot | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, externalId: true, providerId: true },
  });
  if (match == null) return null;

  // Este endpoint se reserva para eventos/minuto del partido. El marcador y el
  // estado general ya se actualizan mediante el scoreboard global compartido.
  const client = await createClient(match.providerId, CORE_RUN_LIMIT);
  const [fixtureRows, rawEvents] = await Promise.all([
    client.get<RawFixtureStatus>('/fixtures', { id: match.externalId }),
    client.get<RawFixtureEvent>('/fixtures/events', { fixture: match.externalId }),
  ]);
  const rawFixture = fixtureRows[0];
  if (rawFixture == null) return null;

  const fixture = mapFixture(rawFixture);
  const events = mapFixtureEvents(rawEvents);

  await persistFixture(matchId, rawFixture);
  await replaceMatchEvents(prisma, match.providerId, matchId, events);

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
