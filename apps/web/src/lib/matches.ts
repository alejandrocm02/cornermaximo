import { prisma } from '@futstats/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG } from '@/lib/cache';

const MATCH_DATA_REVALIDATE_SECONDS = 5 * 60;
const MATCH_FILTERS_REVALIDATE_SECONDS = 60 * 60;
const MADRID_TIME_ZONE = 'Europe/Madrid';
const MAX_MATCHES_PER_VIEW = 120;

export type MatchCenterView = 'today' | 'upcoming' | 'recent';

export interface MatchCenterFilters {
  competitions: Array<{ slug: string; name: string }>;
  teams: Array<{ slug: string; name: string }>;
}

export interface MatchListItem {
  id: number;
  kickoffAt: string;
  status: string;
  round: string | null;
  hasExtraTime: boolean;
  hasPenalties: boolean;
  competition: {
    name: string;
    slug: string;
    type: string;
    logoUrl: string | null;
    externalId: string;
  };
  home: MatchListTeam | null;
  away: MatchListTeam | null;
}

export interface MatchListTeam {
  id: number;
  name: string;
  slug: string;
  crestUrl: string | null;
  goals: number | null;
  penaltyGoals: number | null;
}

export interface MatchDetailPlayer {
  id: number;
  slug: string;
  name: string;
  photoUrl: string | null;
  teamId: number;
  teamName: string;
  role: string;
  positionPlayed: string | null;
  shirtNumber: number | null;
  minutesPlayed: number;
  rating: number | null;
  isCaptain: boolean;
  subbedInMinute: number | null;
  subbedOutMinute: number | null;
  fieldStats: {
    goals: number | null;
    assists: number | null;
    shotsTotal: number | null;
    shotsOnTarget: number | null;
    passesAttempted: number | null;
    passesCompleted: number | null;
    keyPasses: number | null;
    tacklesWon: number | null;
    interceptions: number | null;
    duelsTotal: number | null;
    duelsWon: number | null;
    yellowCards: number | null;
    redCards: number | null;
  } | null;
  goalkeeperStats: {
    saves: number | null;
    goalsConceded: number | null;
    cleanSheet: boolean | null;
    penaltiesSaved: number | null;
  } | null;
}

export interface MatchDetailEvent {
  id: number;
  type: string;
  minute: number;
  extraMinute: number | null;
  detail: string | null;
  teamExternalId: string | null;
  player: { name: string; slug: string } | null;
  assistPlayer: { name: string; slug: string } | null;
}

export interface MatchDetail extends MatchListItem {
  players: MatchDetailPlayer[];
  events: MatchDetailEvent[];
}

interface MatchCenterQuery {
  view: MatchCenterView;
  date?: string;
  competitionSlug?: string;
  teamSlug?: string;
}

function madridDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MADRID_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function zonedDateTimeToUtc(year: number, month: number, day: number, hour = 0): Date {
  const initial = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MADRID_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(initial);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  const offset = representedAsUtc - initial.getTime();
  return new Date(initial.getTime() - offset);
}

function madridDayRange(value: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match == null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: zonedDateTimeToUtc(year, month, day),
    end: zonedDateTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()),
  };
}

export function todayInMadrid(date = new Date()): string {
  const { year, month, day } = madridDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isValidMatchDate(value: string | undefined): value is string {
  return value != null && madridDayRange(value) != null;
}

function serializeListMatch(match: Awaited<ReturnType<typeof queryMatches>>[number]): MatchListItem {
  const home = match.teams.find((team) => team.isHome);
  const away = match.teams.find((team) => !team.isHome);
  const toTeam = (entry: typeof home): MatchListTeam | null =>
    entry == null
      ? null
      : {
          id: entry.team.id,
          name: entry.team.name,
          slug: entry.team.slug,
          crestUrl: entry.team.crestUrl,
          goals: entry.goals,
          penaltyGoals: entry.penaltyGoals,
        };

  return {
    id: match.id,
    kickoffAt: match.kickoffAt.toISOString(),
    status: String(match.status),
    round: match.round,
    hasExtraTime: match.hasExtraTime,
    hasPenalties: match.hasPenalties,
    competition: {
      name: match.season.competition.name,
      slug: match.season.competition.slug,
      type: String(match.season.competition.type),
      logoUrl: match.season.competition.logoUrl,
      externalId: match.season.competition.externalId,
    },
    home: toTeam(home),
    away: toTeam(away),
  };
}

function queryMatches(query: MatchCenterQuery) {
  const now = new Date();
  let kickoffAt: { gte: Date; lt?: Date; lte?: Date };
  let statuses: string[] | undefined;

  if (query.date != null) {
    const range = madridDayRange(query.date);
    if (range == null) return Promise.resolve([]);
    kickoffAt = { gte: range.start, lt: range.end };
  } else if (query.view === 'upcoming') {
    kickoffAt = { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) };
    statuses = ['SCHEDULED', 'LIVE'];
  } else if (query.view === 'recent') {
    kickoffAt = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), lte: now };
    statuses = ['FINISHED'];
  } else {
    const range = madridDayRange(todayInMadrid(now))!;
    kickoffAt = { gte: range.start, lt: range.end };
  }

  return prisma.match.findMany({
    where: {
      kickoffAt,
      ...(statuses != null ? { status: { in: statuses as never[] } } : {}),
      season: {
        isCurrent: true,
        ...(query.competitionSlug != null
          ? { competition: { slug: query.competitionSlug } }
          : {}),
      },
      ...(query.teamSlug != null
        ? { teams: { some: { team: { slug: query.teamSlug } } } }
        : {}),
    },
    include: {
      season: {
        include: {
          competition: {
            select: { name: true, slug: true, type: true, logoUrl: true, externalId: true },
          },
        },
      },
      teams: {
        include: {
          team: { select: { id: true, name: true, slug: true, crestUrl: true } },
        },
      },
    },
    orderBy: { kickoffAt: query.view === 'recent' && query.date == null ? 'desc' : 'asc' },
    take: MAX_MATCHES_PER_VIEW,
  });
}

async function queryMatchCenter(
  view: MatchCenterView,
  date: string,
  competitionSlug: string,
  teamSlug: string,
): Promise<MatchListItem[]> {
  const matches = await queryMatches({
    view,
    ...(date !== '' ? { date } : {}),
    ...(competitionSlug !== '' ? { competitionSlug } : {}),
    ...(teamSlug !== '' ? { teamSlug } : {}),
  });
  return matches.map(serializeListMatch);
}

const cachedMatchCenter = unstable_cache(queryMatchCenter, ['match-center'], {
  revalidate: MATCH_DATA_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG, 'matches'],
});

export function getMatchCenter(query: MatchCenterQuery): Promise<MatchListItem[]> {
  return cachedMatchCenter(
    query.view,
    query.date ?? '',
    query.competitionSlug ?? '',
    query.teamSlug ?? '',
  );
}

async function queryMatchFilters(): Promise<MatchCenterFilters> {
  const [competitions, teams] = await Promise.all([
    prisma.competition.findMany({
      where: { seasons: { some: { isCurrent: true } } },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({
      where: { seasons: { some: { season: { isCurrent: true } } } },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { competitions, teams };
}

const cachedMatchFilters = unstable_cache(queryMatchFilters, ['match-center-filters'], {
  revalidate: MATCH_FILTERS_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG, 'matches'],
});

export function getMatchFilters(): Promise<MatchCenterFilters> {
  return cachedMatchFilters();
}

async function queryMatchDetail(id: number): Promise<MatchDetail | null> {
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      season: {
        include: {
          competition: {
            select: { name: true, slug: true, type: true, logoUrl: true, externalId: true },
          },
        },
      },
      teams: {
        include: { team: { select: { id: true, name: true, slug: true, crestUrl: true } } },
      },
      matchPlayers: {
        include: {
          player: { select: { id: true, slug: true, fullName: true, knownAs: true, photoUrl: true } },
          team: { select: { name: true } },
          fieldStats: true,
          gkStats: true,
        },
        orderBy: [{ teamId: 'asc' }, { role: 'asc' }, { shirtNumber: 'asc' }],
      },
      events: { orderBy: [{ minute: 'asc' }, { extraMinute: 'asc' }] },
    },
  });
  if (match == null) return null;

  const playerIds = [
    ...new Set(
      match.events
        .flatMap((event) => [event.playerId, event.assistPlayerId])
        .filter((playerId): playerId is number => playerId != null),
    ),
  ];
  const eventPlayers =
    playerIds.length === 0
      ? []
      : await prisma.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, fullName: true, knownAs: true, slug: true },
        });
  const playerById = new Map(eventPlayers.map((player) => [player.id, player]));

  const base = serializeListMatch(match);
  return {
    ...base,
    players: match.matchPlayers.map((entry) => ({
      id: entry.player.id,
      slug: entry.player.slug,
      name: entry.player.knownAs ?? entry.player.fullName,
      photoUrl: entry.player.photoUrl,
      teamId: entry.teamId,
      teamName: entry.team.name,
      role: String(entry.role),
      positionPlayed: entry.positionPlayed,
      shirtNumber: entry.shirtNumber,
      minutesPlayed: entry.minutesPlayed,
      rating: entry.rating,
      isCaptain: entry.isCaptain,
      subbedInMinute: entry.subbedInMinute,
      subbedOutMinute: entry.subbedOutMinute,
      fieldStats:
        entry.fieldStats == null
          ? null
          : {
              goals: entry.fieldStats.goals,
              assists: entry.fieldStats.assists,
              shotsTotal: entry.fieldStats.shotsTotal,
              shotsOnTarget: entry.fieldStats.shotsOnTarget,
              passesAttempted: entry.fieldStats.passesAttempted,
              passesCompleted: entry.fieldStats.passesCompleted,
              keyPasses: entry.fieldStats.keyPasses,
              tacklesWon: entry.fieldStats.tacklesWon,
              interceptions: entry.fieldStats.interceptions,
              duelsTotal: entry.fieldStats.duelsTotal,
              duelsWon: entry.fieldStats.duelsWon,
              yellowCards: entry.fieldStats.yellowCards,
              redCards: entry.fieldStats.redCards,
            },
      goalkeeperStats:
        entry.gkStats == null
          ? null
          : {
              saves: entry.gkStats.saves,
              goalsConceded: entry.gkStats.goalsConceded,
              cleanSheet: entry.gkStats.cleanSheet,
              penaltiesSaved: entry.gkStats.penaltiesSaved,
            },
    })),
    events: match.events.map((event) => {
      const player = event.playerId != null ? playerById.get(event.playerId) : null;
      const assistPlayer = event.assistPlayerId != null ? playerById.get(event.assistPlayerId) : null;
      return {
        id: event.id,
        type: String(event.type),
        minute: event.minute,
        extraMinute: event.extraMinute,
        detail: event.detail,
        teamExternalId: event.teamExternalId,
        player:
          player == null
            ? null
            : { name: player.knownAs ?? player.fullName, slug: player.slug },
        assistPlayer:
          assistPlayer == null
            ? null
            : { name: assistPlayer.knownAs ?? assistPlayer.fullName, slug: assistPlayer.slug },
      };
    }),
  };
}

const cachedMatchDetail = unstable_cache(queryMatchDetail, ['match-detail'], {
  revalidate: MATCH_DATA_REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG, 'matches'],
});

export function getMatchDetail(id: number): Promise<MatchDetail | null> {
  return cachedMatchDetail(id);
}
