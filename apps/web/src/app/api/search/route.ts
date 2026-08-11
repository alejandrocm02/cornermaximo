/**
 * GET /api/search?q=texto&scope=all|players
 *
 * Búsqueda global tolerante a mayúsculas y acentos. Las respuestas se cachean
 * por consulta normalizada durante cinco minutos y se invalidan cuando termina
 * una tanda de sincronización de datos.
 */
import { prisma } from '@cornermaximo/db';
import { WORLD_CUP_2026 } from '@cornermaximo/shared';
import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { FOOTBALL_DATA_CACHE_TAG } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const SEARCH_CACHE_SECONDS = 5 * 60;

// lower() se aplica antes de translate(), por lo que solo hacen falta minúsculas.
const ACCENTED = 'áàâäãåéèêëíìîïóòôöõúùûüçñý';
const PLAIN = 'aaaaaaeeeeiiiiooooouuuucny';

type SearchScope = 'all' | 'players';

interface PlayerRow {
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
}

interface TeamRow {
  slug: string;
  name: string;
  crestUrl: string | null;
  isNational: boolean;
}

interface LeagueRow {
  slug: string;
  name: string;
  type: string;
}

interface SearchResponse {
  players: Array<PlayerRow & { href: string }>;
  teams: Array<TeamRow & { href: string }>;
  leagues: Array<{ slug: string; name: string; href: string }>;
}

function normalizeQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Evita que los comodines de LIKE amplíen accidentalmente la consulta.
    .replace(/[%_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchPlayers(query: string): Promise<PlayerRow[]> {
  const prefix = `${query}%`;
  const wordPrefix = `% ${query}%`;
  const contains = `%${query}%`;

  return prisma.$queryRawUnsafe<PlayerRow[]>(
    `
    WITH candidates AS (
      SELECT p.slug,
             COALESCE(p."knownAs", p."fullName") AS name,
             p."photoUrl" AS "photoUrl",
             t.name AS team,
             translate(lower(p."fullName"), '${ACCENTED}', '${PLAIN}') AS full_search,
             translate(lower(COALESCE(p."knownAs", '')), '${ACCENTED}', '${PLAIN}') AS known_search
      FROM "Player" p
      LEFT JOIN "Team" t ON t.id = p."currentTeamId"
    )
    SELECT slug, name, "photoUrl", team
    FROM candidates
    WHERE full_search LIKE $3 OR known_search LIKE $3
    ORDER BY
      CASE
        WHEN full_search = $1 OR known_search = $1 THEN 0
        WHEN full_search LIKE $2 OR known_search LIKE $2 THEN 1
        WHEN full_search LIKE $4 OR known_search LIKE $4 THEN 2
        ELSE 3
      END,
      length(name),
      name
    LIMIT 8
    `,
    query,
    prefix,
    contains,
    wordPrefix,
  );
}

async function searchTeams(query: string): Promise<TeamRow[]> {
  const prefix = `${query}%`;
  const wordPrefix = `% ${query}%`;
  const contains = `%${query}%`;

  return prisma.$queryRawUnsafe<TeamRow[]>(
    `
    WITH candidates AS (
      SELECT slug,
             name,
             "crestUrl",
             "isNational",
             translate(lower(name), '${ACCENTED}', '${PLAIN}') AS name_search,
             translate(lower(COALESCE("shortName", '')), '${ACCENTED}', '${PLAIN}') AS short_search
      FROM "Team"
    )
    SELECT slug, name, "crestUrl", "isNational"
    FROM candidates
    WHERE name_search LIKE $3 OR short_search LIKE $3
    ORDER BY
      CASE
        WHEN name_search = $1 OR short_search = $1 THEN 0
        WHEN name_search LIKE $2 OR short_search LIKE $2 THEN 1
        WHEN name_search LIKE $4 OR short_search LIKE $4 THEN 2
        ELSE 3
      END,
      length(name),
      name
    LIMIT 4
    `,
    query,
    prefix,
    contains,
    wordPrefix,
  );
}

async function searchLeagues(query: string): Promise<LeagueRow[]> {
  const prefix = `${query}%`;
  const wordPrefix = `% ${query}%`;
  const contains = `%${query}%`;

  return prisma.$queryRawUnsafe<LeagueRow[]>(
    `
    WITH candidates AS (
      SELECT slug,
             name,
             type::text AS type,
             translate(lower(name), '${ACCENTED}', '${PLAIN}') AS name_search
      FROM "Competition"
    )
    SELECT slug, name, type
    FROM candidates
    WHERE name_search LIKE $3
    ORDER BY
      CASE
        WHEN name_search = $1 THEN 0
        WHEN name_search LIKE $2 THEN 1
        WHEN name_search LIKE $4 THEN 2
        ELSE 3
      END,
      length(name),
      name
    LIMIT 3
    `,
    query,
    prefix,
    contains,
    wordPrefix,
  );
}

async function searchDatabase(query: string, scope: SearchScope): Promise<SearchResponse> {
  if (scope === 'players') {
    const players = await searchPlayers(query);
    return {
      players: players.map((player) => ({ ...player, href: `/jugadores/${player.slug}` })),
      teams: [],
      leagues: [],
    };
  }

  const [players, teams, leagues] = await Promise.all([
    searchPlayers(query),
    searchTeams(query),
    searchLeagues(query),
  ]);

  return {
    players: players.map((player) => ({ ...player, href: `/jugadores/${player.slug}` })),
    teams: teams.map((team) => ({ ...team, href: `/equipos/${team.slug}` })),
    leagues: leagues.map((league) => ({
      slug: league.slug,
      name: league.name,
      href:
        league.type === 'CUP' && league.slug === WORLD_CUP_2026.slug
          ? '/mundial-2026'
          : `/ligas/${league.slug}`,
    })),
  };
}

const cachedSearch = unstable_cache(searchDatabase, ['global-search-v2'], {
  revalidate: SEARCH_CACHE_SECONDS,
  tags: [FOOTBALL_DATA_CACHE_TAG],
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = normalizeQuery((url.searchParams.get('q') ?? '').slice(0, 80));
  const scope: SearchScope = url.searchParams.get('scope') === 'players' ? 'players' : 'all';

  if (query.length < 2) {
    return NextResponse.json({ players: [], teams: [], leagues: [] });
  }

  try {
    const result = await cachedSearch(query, scope);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': `public, s-maxage=${SEARCH_CACHE_SECONDS}, stale-while-revalidate=${SEARCH_CACHE_SECONDS * 2}`,
      },
    });
  } catch (error) {
    console.error('Global search failed', error);
    return NextResponse.json(
      { error: 'SEARCH_UNAVAILABLE', message: 'El buscador no está disponible temporalmente.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
