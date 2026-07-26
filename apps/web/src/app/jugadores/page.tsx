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
          <select name="posicion" defaultValue={posicion} className="w-full rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white outline-none transition focus:border-pitch-accent/60 sm:w-auto">
            <option value="">Todas</option>
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Liga</span>
          <select name="liga" defaultValue={liga} className="w-full rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white outline-none transition focus:border-pitch-accent/60 sm:w-auto">
            <option value="">Todas</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.slug}>{l.name}</option>
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
            {teams.map((t) => (
              <option key={t.slug} value={t.slug}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Ordenar por</span>
          <select name="orden" defaultValue={orden} className="w-full rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white outline-none transition focus:border-pitch-accent/60 sm:w-auto">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
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
        {rows.map((p) => (
          <Link
            key={p.slug}
            href={playerHref(p.slug)}
            className="fs-panel-interactive flex items-center gap-3 p-3"
          >
            {p.photoUrl != null ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img width={40} height={40} loading="lazy" decoding="async" src={p.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-pitch-border" />
            ) : (
              <span aria-hidden="true" className="h-11 w-11 shrink-0 rounded-full bg-pitch-elevated ring-1 ring-pitch-border" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{p.name}</p>
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
          <div className="col-span-full rounded-2xl border border-dashed border-pitch-border-strong p-10 text-center text-sm text-pitch-muted">
            <p className="font-display text-base font-semibold text-white">Sin resultados con estos filtros.</p>
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
        <nav aria-label="Paginación de jugadores" className="flex items-center justify-center gap-2 text-sm">
          {pagina > 1 ? (
            <Link
              rel="prev"
              className="rounded-lg border border-pitch-border bg-pitch-card/60 px-4 py-2.5 font-medium text-pitch-subtle transition hover:border-pitch-accent/50 hover:text-white"
              href={pageHref(pagina - 1)}
            >
              <span aria-hidden="true">←</span> Anterior
            </Link>
          ) : (
            <span aria-hidden="true" className="rounded-lg border border-pitch-border/50 px-4 py-2.5 text-pitch-border-strong">
              ← Anterior
            </span>
          )}
          <span aria-current="page" className="px-3 text-2xs tabular-nums text-pitch-muted sm:text-sm">
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
            <span aria-hidden="true" className="rounded-lg border border-pitch-border/50 px-4 py-2.5 text-pitch-border-strong">
              Siguiente →
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
