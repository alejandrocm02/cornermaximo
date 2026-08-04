import { prisma } from '@futstats/db';
import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SearchBox } from '@/components/SearchBox';
import { FOOTBALL_DATA_CACHE_TAG, FOOTBALL_DATA_REVALIDATE_SECONDS } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: { absolute: 'Estadísticas de futbolistas por liga y posición | FutStats' },
  description:
    'Directorio de futbolistas: busca por nombre y filtra por posición, liga y equipo, con orden por goles o minutos.',
  alternates: { canonical: '/jugadores' },
};

const PAGE_SIZE = 24;

const POSITIONS = [
  { value: 'GK', label: 'Portero' },
  { value: 'DF', label: 'Defensa' },
  { value: 'MF', label: 'Centrocampista' },
  { value: 'FW', label: 'Delantero' },
] as const;
const POSITION_LABEL: Record<string, string> = Object.fromEntries(
  POSITIONS.map((position) => [position.value, position.label]),
);

const SORTS = [
  { value: 'nombre', label: 'Nombre (A-Z)' },
  { value: 'minutos', label: 'Minutos jugados' },
  { value: 'goles', label: 'Goles' },
] as const;
type SortKey = (typeof SORTS)[number]['value'];

// lower() se aplica antes de translate(), por lo que solo hacen falta minúsculas.
const ACCENTED = 'áàâäãåéèêëíìîïóòôöõúùûüçñý';
const PLAIN = 'aaaaaaeeeeiiiiooooouuuucny';

function normalizeQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[%_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface DirectoryRow {
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  position: string | null;
  minutes: bigint | null;
  goals: bigint | null;
  total: bigint;
}

const getLeagueOptions = unstable_cache(
  async () =>
    prisma.competition.findMany({
      where: { type: 'LEAGUE' },
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ['player-directory-league-options-v2'],
  { revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS, tags: [FOOTBALL_DATA_CACHE_TAG] },
);

const getTeamOptions = unstable_cache(
  async (league: string) =>
    prisma.team.findMany({
      where: {
        isNational: false,
        ...(league !== ''
          ? {
              seasons: {
                some: {
                  season: { competition: { slug: league }, isCurrent: true },
                },
              },
            }
          : {}),
      },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ['player-directory-team-options-v2'],
  { revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS, tags: [FOOTBALL_DATA_CACHE_TAG] },
);

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    posicion?: string;
    liga?: string;
    equipo?: string;
    orden?: string;
    pagina?: string;
  }>;
}) {
  const search = await searchParams;
  const q = (search.q ?? '').slice(0, 80).replace(/\s+/g, ' ').trim();
  const normalizedQuery = normalizeQuery(q);
  const posicion = POSITIONS.some((position) => position.value === search.posicion)
    ? search.posicion!
    : '';
  const liga = (search.liga ?? '').slice(0, 50).trim();
  const equipo = (search.equipo ?? '').slice(0, 60).trim();
  const orden: SortKey = SORTS.some((sort) => sort.value === search.orden)
    ? (search.orden as SortKey)
    : 'nombre';
  const parsedPage = Number.parseInt(search.pagina ?? '1', 10);
  const pagina = Number.isSafeInteger(parsedPage)
    ? Math.min(10_000, Math.max(1, parsedPage))
    : 1;

  // WHERE dinámico parametrizado. Ningún identificador SQL procede del usuario.
  const conditions: string[] = ['TRUE'];
  const params: unknown[] = [];

  if (normalizedQuery !== '') {
    params.push(`%${normalizedQuery}%`);
    conditions.push(
      `(translate(lower(p."fullName"), '${ACCENTED}', '${PLAIN}') LIKE $${params.length}
        OR translate(lower(COALESCE(p."knownAs", '')), '${ACCENTED}', '${PLAIN}') LIKE $${params.length})`,
    );
  }
  if (posicion !== '') {
    params.push(posicion);
    conditions.push(
      `EXISTS (
         SELECT 1
         FROM "PlayerPosition" pp
         WHERE pp."playerId" = p.id
           AND pp."isPrimary"
           AND pp."group" = $${params.length}::"PositionGroup"
       )`,
    );
  }
  if (liga !== '') {
    params.push(liga);
    conditions.push(
      `p."currentTeamId" IN (
         SELECT st."teamId"
         FROM "SeasonTeam" st
         JOIN "Season" se ON se.id = st."seasonId"
         JOIN "Competition" c ON c.id = se."competitionId"
         WHERE c.slug = $${params.length} AND se."isCurrent"
       )`,
    );
  }
  if (equipo !== '') {
    params.push(equipo);
    conditions.push(
      `p."currentTeamId" = (SELECT team.id FROM "Team" team WHERE team.slug = $${params.length})`,
    );
  }

  const whereSql = conditions.join(' AND ');

  const metricJoin =
    orden === 'minutos'
      ? `LEFT JOIN (
           SELECT mp."playerId", SUM(mp."minutesPlayed")::bigint AS value
           FROM "MatchPlayer" mp
           JOIN filtered_players selected ON selected.id = mp."playerId"
           GROUP BY mp."playerId"
         ) metric ON metric."playerId" = fp.id`
      : orden === 'goles'
        ? `LEFT JOIN (
             SELECT mp."playerId", SUM(stats.goals)::bigint AS value
             FROM "PlayerMatchStatistics" stats
             JOIN "MatchPlayer" mp ON mp.id = stats."matchPlayerId"
             JOIN filtered_players selected ON selected.id = mp."playerId"
             GROUP BY mp."playerId"
           ) metric ON metric."playerId" = fp.id`
        : '';

  const metricSelect =
    orden === 'minutos'
      ? 'metric.value AS minutes, NULL::bigint AS goals'
      : orden === 'goles'
        ? 'NULL::bigint AS minutes, metric.value AS goals'
        : 'NULL::bigint AS minutes, NULL::bigint AS goals';

  const orderSql =
    orden === 'minutos'
      ? 'metric.value DESC NULLS LAST, fp.name ASC'
      : orden === 'goles'
        ? 'metric.value DESC NULLS LAST, fp.name ASC'
        : 'fp.name ASC';

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const rowsPromise = prisma.$queryRawUnsafe<DirectoryRow[]>(
    `WITH filtered_players AS (
       SELECT p.id,
              p.slug,
              COALESCE(p."knownAs", p."fullName") AS name,
              p."photoUrl" AS "photoUrl",
              team.name AS team
       FROM "Player" p
       LEFT JOIN "Team" team ON team.id = p."currentTeamId"
       WHERE ${whereSql}
     )
     SELECT fp.slug,
            fp.name,
            fp."photoUrl",
            fp.team,
            (
              SELECT pp."group"::text
              FROM "PlayerPosition" pp
              WHERE pp."playerId" = fp.id AND pp."isPrimary"
              LIMIT 1
            ) AS position,
            ${metricSelect},
            COUNT(*) OVER()::bigint AS total
     FROM filtered_players fp
     ${metricJoin}
     ORDER BY ${orderSql}
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    ...params,
    PAGE_SIZE,
    (pagina - 1) * PAGE_SIZE,
  );

  const [leagues, teams, rows] = await Promise.all([
    getLeagueOptions(),
    getTeamOptions(liga),
    rowsPromise,
  ]);

  // COUNT(*) OVER evita una consulta adicional en todas las páginas normales.
  // Solo se consulta el total por separado ante una página fuera de rango.
  let total = Number(rows[0]?.total ?? 0);
  if (rows.length === 0 && pagina > 1) {
    const countRows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT COUNT(*)::bigint AS total
       FROM "Player" p
       WHERE ${whereSql}`,
      ...params,
    );
    total = Number(countRows[0]?.total ?? 0);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters =
    q !== '' || posicion !== '' || liga !== '' || equipo !== '' || orden !== 'nombre';

  const filterParams = new URLSearchParams();
  if (q !== '') filterParams.set('q', q);
  if (posicion !== '') filterParams.set('posicion', posicion);
  if (liga !== '') filterParams.set('liga', liga);
  if (equipo !== '') filterParams.set('equipo', equipo);
  if (orden !== 'nombre') filterParams.set('orden', orden);

  const pageHref = (page: number) => {
    const nextParams = new URLSearchParams(filterParams);
    if (page > 1) nextParams.set('pagina', String(page));
    const queryString = nextParams.toString();
    return queryString === '' ? '/jugadores' : `/jugadores?${queryString}`;
  };

  if (total > 0 && pagina > totalPages) redirect(pageHref(totalPages));

  const playerHref = (slug: string) => {
    const returnParams = new URLSearchParams(filterParams);
    if (pagina > 1) returnParams.set('pagina', String(pagina));
    const queryString = returnParams.toString();
    return queryString === ''
      ? `/jugadores/${slug}`
      : `/jugadores/${slug}?desde=${encodeURIComponent(queryString)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="fs-eyebrow">
            <span aria-hidden="true" className="h-1 w-4 rounded-full bg-grad-brand" />
            Directorio
          </p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Jugadores</h1>
        </div>
        <SearchBox placeholder="Ir directo a un jugador, equipo o liga" />
      </div>

      <form
        method="GET"
        action="/jugadores"
        className="fs-panel grid grid-cols-2 items-end gap-3 p-4 text-sm sm:flex sm:flex-wrap"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Nombre</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="p. ej. Mbappé"
            className="w-full min-w-0 rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white outline-none transition placeholder:text-pitch-muted focus:border-pitch-accent/60 sm:w-44"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Posición</span>
          <select
            name="posicion"
            defaultValue={posicion}
            className="w-full rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white outline-none transition focus:border-pitch-accent/60 sm:w-auto"
          >
            <option value="">Todas</option>
            {POSITIONS.map((position) => (
              <option key={position.value} value={position.value}>
                {position.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Liga</span>
          <select
            name="liga"
            defaultValue={liga}
            className="w-full rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white outline-none transition focus:border-pitch-accent/60 sm:w-auto"
          >
            <option value="">Todas</option>
            {leagues.map((league) => (
              <option key={league.id} value={league.slug}>
                {league.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Equipo</span>
          <select
            name="equipo"
            defaultValue={equipo}
            className="w-full rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white outline-none transition focus:border-pitch-accent/60 sm:max-w-44"
          >
            <option value="">Todos</option>
            {teams.map((team) => (
              <option key={team.slug} value={team.slug}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Ordenar por</span>
          <select
            name="orden"
            defaultValue={orden}
            className="w-full rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white outline-none transition focus:border-pitch-accent/60 sm:w-auto"
          >
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-grad-brand px-4 py-2.5 font-semibold text-black shadow-glow-soft transition hover:brightness-110 sm:w-auto"
        >
          Aplicar
        </button>
        {hasFilters && (
          <Link
            href="/jugadores"
            className="w-full rounded-lg border border-pitch-border px-4 py-2.5 text-center text-pitch-muted transition hover:border-pitch-border-strong hover:text-white sm:w-auto"
          >
            Limpiar filtros
          </Link>
        )}
      </form>

      <p className="fs-chip" role="status">
        {total.toLocaleString('es-ES')} {total === 1 ? 'jugador encontrado' : 'jugadores encontrados'}
        {totalPages > 1 && ` · página ${pagina} de ${totalPages}`}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((player) => (
          <Link
            key={player.slug}
            href={playerHref(player.slug)}
            className="fs-panel-interactive flex items-center gap-3 p-3"
          >
            {player.photoUrl != null ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                width={40}
                height={40}
                loading="lazy"
                decoding="async"
                src={player.photoUrl}
                alt=""
                className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-pitch-border"
              />
            ) : (
              <span
                aria-hidden="true"
                className="h-11 w-11 shrink-0 rounded-full bg-pitch-elevated ring-1 ring-pitch-border"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{player.name}</p>
              <p className="truncate text-xs text-pitch-muted">
                {player.position != null
                  ? POSITION_LABEL[player.position] ?? player.position
                  : 'Posición desconocida'}{' '}
                · {player.team ?? 'Sin equipo'}
              </p>
            </div>
            {orden === 'minutos' && player.minutes != null && (
              <span className="shrink-0 text-xs text-pitch-muted">
                {Number(player.minutes).toLocaleString('es-ES')}&apos;
              </span>
            )}
            {orden === 'goles' && player.goals != null && (
              <span className="shrink-0 text-sm font-semibold text-pitch-accent">
                {Number(player.goals)}
              </span>
            )}
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-pitch-border-strong p-10 text-center text-sm text-pitch-muted">
            <p className="font-display text-base font-semibold text-white">
              Sin resultados con estos filtros.
            </p>
            <p className="mx-auto mt-2 max-w-sm">
              Prueba a quitar algún filtro o revisa el nombre —la búsqueda ignora mayúsculas y acentos—.
            </p>
            <Link href="/jugadores" className="fs-btn-ghost mt-5">
              Limpiar filtros
            </Link>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Paginación de jugadores"
          className="flex items-center justify-center gap-2 text-sm"
        >
          {pagina > 1 ? (
            <Link
              rel="prev"
              className="rounded-lg border border-pitch-border bg-pitch-card/60 px-4 py-2.5 font-medium text-pitch-subtle transition hover:border-pitch-accent/50 hover:text-white"
              href={pageHref(pagina - 1)}
            >
              <span aria-hidden="true">←</span> Anterior
            </Link>
          ) : (
            <span
              aria-hidden="true"
              className="rounded-lg border border-pitch-border/50 px-4 py-2.5 text-pitch-border-strong"
            >
              ← Anterior
            </span>
          )}
          <span
            aria-current="page"
            className="px-3 text-2xs tabular-nums text-pitch-muted sm:text-sm"
          >
            Página {pagina} de {totalPages}
          </span>
          {pagina < totalPages ? (
            <Link
              rel="next"
              className="rounded-lg border border-pitch-border bg-pitch-card/60 px-4 py-2.5 font-medium text-pitch-subtle transition hover:border-pitch-accent/50 hover:text-white"
              href={pageHref(pagina + 1)}
            >
              Siguiente <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <span
              aria-hidden="true"
              className="rounded-lg border border-pitch-border/50 px-4 py-2.5 text-pitch-border-strong"
            >
              Siguiente →
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
