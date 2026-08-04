import { prisma } from '@futstats/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG } from '@/lib/cache';
import type { MatchCenterView, MatchListItem, MatchListTeam } from '@/lib/matches';

const MADRID_TIME_ZONE = 'Europe/Madrid';
const PAGE_SIZE = 60;
const REVALIDATE_SECONDS = 5 * 60;

export interface MatchCenterPageResult {
  matches: MatchListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isCompleteDay: boolean;
}

export interface MatchCenterPageQuery {
  view: MatchCenterView;
  date?: string;
  competitionSlug?: string;
  teamSlug?: string;
  page?: number;
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
  return new Date(initial.getTime() - (representedAsUtc - initial.getTime()));
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
  ) return null;

  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: zonedDateTimeToUtc(year, month, day),
    end: zonedDateTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()),
  };
}

function serializeMatch(match: Awaited<ReturnType<typeof queryRows>>[number]): MatchListItem {
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

function buildWhere(view: MatchCenterView, date: string, competitionSlug: string, teamSlug: string) {
  const now = new Date();
  let kickoffAt: { gte: Date; lt?: Date; lte?: Date };
  let statuses: string[] | undefined;

  if (date !== '') {
    const range = madridDayRange(date);
    if (range == null) return null;
    kickoffAt = { gte: range.start, lt: range.end };
  } else if (view === 'upcoming') {
    kickoffAt = { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) };
    statuses = ['SCHEDULED', 'LIVE'];
  } else if (view === 'recent') {
    kickoffAt = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), lte: now };
    statuses = ['FINISHED'];
  } else {
    return null;
  }

  return {
    kickoffAt,
    ...(statuses != null ? { status: { in: statuses as never[] } } : {}),
    season: {
      isCurrent: true,
      ...(competitionSlug !== '' ? { competition: { slug: competitionSlug } } : {}),
    },
    ...(teamSlug !== '' ? { teams: { some: { team: { slug: teamSlug } } } } : {}),
  };
}

function queryRows(where: NonNullable<ReturnType<typeof buildWhere>>, skip?: number, take?: number) {
  return prisma.match.findMany({
    where,
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
    },
    orderBy: { kickoffAt: 'asc' },
    ...(skip != null ? { skip } : {}),
    ...(take != null ? { take } : {}),
  });
}

async function queryMatchCenterPage(
  view: MatchCenterView,
  date: string,
  competitionSlug: string,
  teamSlug: string,
  requestedPage: number,
): Promise<MatchCenterPageResult> {
  const where = buildWhere(view, date, competitionSlug, teamSlug);
  if (where == null) {
    return { matches: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1, isCompleteDay: date !== '' };
  }

  const isCompleteDay = date !== '';
  if (isCompleteDay) {
    const rows = await queryRows(where);
    return {
      matches: rows.map(serializeMatch),
      total: rows.length,
      page: 1,
      pageSize: rows.length,
      totalPages: 1,
      isCompleteDay: true,
    };
  }

  const total = await prisma.match.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const rows = await queryRows(where, (page - 1) * PAGE_SIZE, PAGE_SIZE);
  if (view === 'recent') rows.reverse();

  return {
    matches: rows.map(serializeMatch),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages,
    isCompleteDay: false,
  };
}

const cachedMatchCenterPage = unstable_cache(queryMatchCenterPage, ['match-center-page-v2'], {
  revalidate: REVALIDATE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG, 'matches'],
});

export function getMatchCenterPage(query: MatchCenterPageQuery): Promise<MatchCenterPageResult> {
  return cachedMatchCenterPage(
    query.view,
    query.date ?? '',
    query.competitionSlug ?? '',
    query.teamSlug ?? '',
    query.page ?? 1,
  );
}

export function adjacentMadridDate(value: string, offsetDays: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match == null) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + offsetDays));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
