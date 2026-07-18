/**
 * GET /api/search?q=texto — búsqueda global: jugadores, equipos y ligas.
 * Tolerante a mayúsculas y acentos: se normaliza la consulta en JS y las
 * columnas con translate() en SQL (sin necesidad de extensiones de Postgres).
 */
import { prisma } from '@futstats/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// translate() mapea carácter a carácter: ambas cadenas miden lo mismo.
const ACCENTED = 'áàâäãåéèêëíìîïóòôöõúùûüçñýÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑÝ';
const PLAIN = 'aaaaaaeeeeiiiiooooouuuucnyAAAAAAEEEEIIIIOOOOOUUUUCNY';

function normalize(q: string): string {
  return q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

interface PlayerRow { slug: string; name: string; photoUrl: string | null; team: string | null }
interface TeamRow { slug: string; name: string; crestUrl: string | null; isNational: boolean }
interface LeagueRow { slug: string; name: string; type: string }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = normalize((url.searchParams.get('q') ?? '').slice(0, 80));
  if (q.length < 2) {
    return NextResponse.json({ players: [], teams: [], leagues: [] });
  }
  const pattern = `%${q}%`;

  const [players, teams, leagues] = await Promise.all([
    prisma.$queryRawUnsafe<PlayerRow[]>(
      `
      SELECT p.slug,
             COALESCE(p."knownAs", p."fullName") AS name,
             p."photoUrl" AS "photoUrl",
             t.name AS team
      FROM "Player" p
      LEFT JOIN "Team" t ON t.id = p."currentTeamId"
      WHERE translate(lower(p."fullName"), '${ACCENTED}', '${PLAIN}') LIKE $1
         OR translate(lower(COALESCE(p."knownAs", '')), '${ACCENTED}', '${PLAIN}') LIKE $1
      ORDER BY p."fullName"
      LIMIT 8
      `,
      pattern,
    ),
    prisma.$queryRawUnsafe<TeamRow[]>(
      `
      SELECT slug, name, "crestUrl", "isNational"
      FROM "Team"
      WHERE translate(lower(name), '${ACCENTED}', '${PLAIN}') LIKE $1
      ORDER BY name
      LIMIT 4
      `,
      pattern,
    ),
    prisma.$queryRawUnsafe<LeagueRow[]>(
      `
      SELECT slug, name, type::text AS type
      FROM "Competition"
      WHERE translate(lower(name), '${ACCENTED}', '${PLAIN}') LIKE $1
      ORDER BY name
      LIMIT 3
      `,
      pattern,
    ),
  ]);

  return NextResponse.json({
    players: players.map((p) => ({ ...p, href: `/jugadores/${p.slug}` })),
    teams: teams.map((t) => ({ ...t, href: `/equipos/${t.slug}` })),
    leagues: leagues.map((l) => ({
      slug: l.slug,
      name: l.name,
      href: l.type === 'CUP' ? '/mundial-2026' : `/ligas/${l.slug}`,
    })),
  });
}
