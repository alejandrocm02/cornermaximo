import { prisma } from '@futstats/db';
import Link from 'next/link';
import { SearchBox } from '@/components/SearchBox';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Jugadores' };

const POSITIONS = [
  { value: '', label: 'Todas las posiciones' },
  { value: 'GK', label: 'Porteros' },
  { value: 'DF', label: 'Defensas' },
  { value: 'MF', label: 'Centrocampistas' },
  { value: 'FW', label: 'Delanteros' },
];

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ position?: string; league?: string; page?: string }>;
}) {
  const { position, league, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const pageSize = 24;

  // El filtro usa el club actual del jugador, así que no aplica bien a competiciones de
  // selecciones (Mundial): esas se navegan desde /mundial-2026 (selecciones y goleadores).
  const leagues = await prisma.competition.findMany({ where: { type: 'LEAGUE' }, orderBy: { name: 'asc' } });

  const where = {
    ...(position != null && position !== ''
      ? { positions: { some: { group: position as 'GK' | 'DF' | 'MF' | 'FW', isPrimary: true } } }
      : {}),
    ...(league != null && league !== ''
      ? { currentTeam: { seasons: { some: { season: { competition: { slug: league }, isCurrent: true } } } } }
      : {}),
  };

  const [total, players] = await Promise.all([
    prisma.player.count({ where }),
    prisma.player.findMany({
      where,
      include: {
        currentTeam: { select: { name: true, slug: true } },
        positions: { where: { isPrimary: true } },
      },
      orderBy: { fullName: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Jugadores</h1>
        <SearchBox placeholder="Búsqueda rápida…" />
      </div>

      <form method="GET" className="flex flex-wrap gap-3 text-sm">
        <select name="position" defaultValue={position ?? ''} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
          {POSITIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select name="league" defaultValue={league ?? ''} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
          <option value="">Todas las ligas</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.slug}>{l.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-pitch-accent px-4 py-2 font-medium text-black">
          Filtrar
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => (
          <Link
            key={p.id}
            href={`/jugadores/${p.slug}`}
            className="flex items-center gap-3 rounded-xl border border-pitch-border bg-pitch-card p-3 hover:border-pitch-accent"
          >
            {p.photoUrl != null ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="h-10 w-10 rounded-full bg-pitch-border" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.knownAs ?? p.fullName}</p>
              <p className="truncate text-xs text-pitch-muted">
                {p.positions[0]?.group ?? '—'} · {p.currentTeam?.name ?? 'Sin equipo'}
              </p>
            </div>
          </Link>
        ))}
        {players.length === 0 && (
          <p className="col-span-3 rounded-xl border border-dashed border-pitch-border p-6 text-center text-sm text-pitch-muted">
            No hay jugadores con esos filtros (o la base de datos aún está vacía).
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link className="text-pitch-accent" href={`?position=${position ?? ''}&league=${league ?? ''}&page=${page - 1}`}>
              ← Anterior
            </Link>
          )}
          <span className="text-pitch-muted">Página {page} de {totalPages}</span>
          {page < totalPages && (
            <Link className="text-pitch-accent" href={`?position=${position ?? ''}&league=${league ?? ''}&page=${page + 1}`}>
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
