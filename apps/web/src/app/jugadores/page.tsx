import { prisma } from '@futstats/db';
import Link from 'next/link';
import { SearchBox } from '@/components/SearchBox';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: { absolute: 'Estadísticas de futbolistas por liga y posición | FutStats' },
  description:
    'Directorio de futbolistas de las 5 grandes ligas: busca por nombre y filtra por posición, liga y equipo, con orden por goles o minutos.',
  alternates: { canonical: '/jugadores' },
};

const PAGE_SIZE = 24;

// Nombres completos de las posiciones (sin abreviaturas crípticas)
const POSITIONS = [
  { value: 'GK', label: 'Portero' },
  { value: 'DF', label: 'Defensa' },
  { value: 'MF', label: 'Centrocampista' },
  { value: 'FW', label: 'Delantero' },
] as const;
const POSITION_LABEL: Record<string, string> = Object.fromEntries(POSITIONS.map((p) => [p.value, p.label]));

const SORTS = [
  { value: 'nombre', label: 'Nombre (A-Z)' },
  { value: 'minutos', label: 'Minutos jugados' },
  { value: 'goles', label: 'Goles' },
] as const;
type SortKey = (typeof SORTS)[number]['value'];

// Tolerancia a acentos sin extensiones: translate() carácter a carácter.
const ACCENTED = 'áàâäãåéèêëíìîïóòôöõúùûüçñýÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑÝ';
const PLAIN = 'aaaaaaeeeeiiiiooooouuuucnyAAAAAAEEEEIIIIOOOOOUUUUCNY';

function normalize(q: string): string {
  return q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

interface DirectoryRow {
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  position: string | null;
  minutes: bigint | null;
  goals: bigint | null;
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; posicion?: string; liga?: string; equipo?: string; orden?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 80).trim();
  const posicion = POSITIONS.some((p) => p.value === sp.posicion) ? sp.posicion! : '';
  const liga = (sp.liga ?? '').slice(0, 50);
  const equipo = (sp.equipo ?? '').slice(0, 60);
  const orden: SortKey = SORTS.some((s) => s.value === sp.orden) ? (sp.orden as SortKey) : 'nombre';
  const pagina = Math.max(1, Number(sp.pagina ?? 1) || 1);

  // Opciones de filtros
  const [leagues, teams] = await Promise.all([
    prisma.competition.findMany({ where: { type: 'LEAGUE' }, orderBy: { name: 'asc' } }),
    prisma.team.findMany({
      where: {
        isNational: false,
        ...(liga !== ''
          ? { seasons: { some: { season: { competition: { slug: liga }, isCurrent: true } } } }
          : {}),
      },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // WHERE dinámico parametrizado (los nombres de columna nunca vienen del usuario)
  const conditions: string[] = ['TRUE'];
  const params: unknown[] = [];
  if (q !== '') {
    params.push(`%${normalize(q)}%`);
    conditions.push(
      `(translate(lower(p."fullName"), '${ACCENTED}', '${PLAIN}') LIKE $${params.length}
        OR translate(lower(COALESCE(p."knownAs", '')), '${ACCENTED}', '${PLAIN}') LIKE $${params.length})`,
    );
  }
  if (posicion !== '') {
    params.push(posicion);
    conditions.push(
      `EXISTS (SELECT 1 FROM "PlayerPosition" pp WHERE pp."playerId" = p.id AND pp."isPrimary" AND pp."group" = $${params.length}::"PositionGroup")`,
    );
  }
  if (liga !== '') {
    params.push(liga);
    conditions.push(
      `p."currentTeamId" IN (
         SELECT st."teamId" FROM "SeasonTeam" st
         JOIN "Season" se ON se.id = st."seasonId"
         JOIN "Competition" c ON c.id = se."competitionId"
         WHERE c.slug = $${params.length} AND se."isCurrent"
       )`,
    );
  }
  if (equipo !== '') {
    params.push(equipo);
    conditions.push(`t.slug = $${params.length}`);
  }
  const whereSql = conditions.join(' AND ');

  const orderSql =
    orden === 'minutos'
      ? 'minutes DESC NULLS LAST, name ASC'
      : orden === 'goles'
        ? 'goals DESC NULLS LAST, name ASC'
        : 'name ASC';

  const countParams = [...params];
  const [countRows, rows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT count(*)::bigint AS total
       FROM "Player" p
       LEFT JOIN "Team" t ON t.id = p."currentTeamId"
       WHERE ${whereSql}`,
      ...countParams,
    ),
    prisma.$queryRawUnsafe<DirectoryRow[]>(
      `SELECT p.slug,
              COALESCE(p."knownAs", p."fullName") AS name,
              p."photoUrl" AS "photoUrl",
              t.name AS team,
              (SELECT pp."group"::text FROM "PlayerPosition" pp WHERE pp."playerId" = p.id AND pp."isPrimary" LIMIT 1) AS position,
              mm.minutes,
              gg.goals
       FROM "Player" p
       LEFT JOIN "Team" t ON t.id = p."currentTeamId"
       LEFT JOIN (
         SELECT mp."playerId", SUM(mp."minutesPlayed")::bigint AS minutes
         FROM "MatchPlayer" mp GROUP BY mp."playerId"
       ) mm ON mm."playerId" = p.id
       LEFT JOIN (
         SELECT mp."playerId", SUM(s.goals)::bigint AS goals
         FROM "PlayerMatchStatistics" s
         JOIN "MatchPlayer" mp ON mp.id = s."matchPlayerId"
         GROUP BY mp."playerId"
       ) gg ON gg."playerId" = p.id
       WHERE ${whereSql}
       ORDER BY ${orderSql}
       LIMIT ${PAGE_SIZE} OFFSET ${(pagina - 1) * PAGE_SIZE}`,
      ...params,
    ),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = q !== '' || posicion !== '' || liga !== '' || equipo !== '' || orden !== 'nombre';

  /** Query string actual (sin página) para persistir filtros en enlaces. */
  const filterQs = new URLSearchParams();
  if (q !== '') filterQs.set('q', q);
  if (posicion !== '') filterQs.set('posicion', posicion);
  if (liga !== '') filterQs.set('liga', liga);
  if (equipo !== '') filterQs.set('equipo', equipo);
  if (orden !== 'nombre') filterQs.set('orden', orden);
  const qsBase = filterQs.toString();

  const pageHref = (n: number) => {
    const p = new URLSearchParams(filterQs);
    if (n > 1) p.set('pagina', String(n));
    const s = p.toString();
    return s === '' ? '/jugadores' : `/jugadores?${s}`;
  };
  /** Enlace al perfil conservando los filtros para el enlace de vuelta. */
  const playerHref = (slug: string) => {
    const p = new URLSearchParams(filterQs);
    if (pagina > 1) p.set('pagina', String(pagina));
    const s = p.toString();
    return s === '' ? `/jugadores/${slug}` : `/jugadores/${slug}?desde=${encodeURIComponent(s)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Jugadores</h1>
        <SearchBox placeholder="Ir directo a un jugador, equipo o liga" />
      </div>

      <form method="GET" action="/jugadores" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Nombre</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="p. ej. Mbappé"
            className="w-full min-w-0 rounded-lg sm:w-44 border border-pitch-border bg-pitch-card px-3 py-2 outline-none focus:border-pitch-accent focus:ring-2 focus:ring-pitch-accent/40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Posición</span>
          <select name="posicion" defaultValue={posicion} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
            <option value="">Todas</option>
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Liga</span>
          <select name="liga" defaultValue={liga} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
            <option value="">Todas</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.slug}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Equipo</span>
          <select name="equipo" defaultValue={equipo} className="w-full rounded-lg sm:max-w-44 border border-pitch-border bg-pitch-card px-3 py-2">
            <option value="">Todos</option>
            {teams.map((t) => (
              <option key={t.slug} value={t.slug}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Ordenar por</span>
          <select name="orden" defaultValue={orden} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-pitch-accent px-4 py-2 font-medium text-black">
          Aplicar
        </button>
        {hasFilters && (
          <Link href="/jugadores" className="rounded-lg border border-pitch-border px-4 py-2 text-pitch-muted hover:text-white">
            Limpiar filtros
          </Link>
        )}
      </form>

      <p className="text-sm text-pitch-muted" role="status">
        {total.toLocaleString('es-ES')} {total === 1 ? 'jugador encontrado' : 'jugadores encontrados'}
        {totalPages > 1 && ` · página ${pagina} de ${totalPages}`}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <Link
            key={p.slug}
            href={playerHref(p.slug)}
            className="flex items-center gap-3 rounded-xl border border-pitch-border bg-pitch-card p-3 hover:border-pitch-accent"
          >
            {p.photoUrl != null ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img width={40} height={40} loading="lazy" decoding="async" src={p.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="h-10 w-10 rounded-full bg-pitch-border" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="truncate text-xs text-pitch-muted">
                {p.position != null ? POSITION_LABEL[p.position] ?? p.position : 'Posición desconocida'} · {p.team ?? 'Sin equipo'}
              </p>
            </div>
            {orden === 'minutos' && p.minutes != null && (
              <span className="shrink-0 text-xs text-pitch-muted">{Number(p.minutes).toLocaleString('es-ES')}&apos;</span>
            )}
            {orden === 'goles' && p.goals != null && (
              <span className="shrink-0 text-sm font-semibold text-pitch-accent">{Number(p.goals)}</span>
            )}
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-pitch-border p-8 text-center text-sm text-pitch-muted">
            <p className="font-medium text-white">Sin resultados con estos filtros.</p>
            <p className="mt-1">
              Prueba a quitar algún filtro o revisa el nombre —la búsqueda ignora mayúsculas y acentos—.
            </p>
            <Link href="/jugadores" className="mt-3 inline-block rounded-lg border border-pitch-border px-4 py-2 hover:border-pitch-accent">
              Limpiar filtros
            </Link>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Paginación de jugadores" className="flex items-center justify-center gap-4 text-sm">
          {pagina > 1 ? (
            <Link rel="prev" className="rounded px-3 py-2 text-pitch-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-pitch-accent" href={pageHref(pagina - 1)}>
              ← Anterior
            </Link>
          ) : (
            <span aria-hidden="true" className="px-2 py-1 text-pitch-border">← Anterior</span>
          )}
          <span aria-current="page" className="text-pitch-muted">
            Página {pagina} de {totalPages}
          </span>
          {pagina < totalPages ? (
            <Link rel="next" className="rounded px-3 py-2 text-pitch-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-pitch-accent" href={pageHref(pagina + 1)}>
              Siguiente →
            </Link>
          ) : (
            <span aria-hidden="true" className="px-2 py-1 text-pitch-border">Siguiente →</span>
          )}
        </nav>
      )}
    </div>
  );
}
