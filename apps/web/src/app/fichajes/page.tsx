import { prisma, type Prisma } from '@futstats/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CATEGORY_LABELS, TRANSFER_STATUS, TRANSFER_TYPE_LABELS, feeLabel, timeAgo } from '@/lib/marketLabels';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const hasFilters = ['club', 'tipo', 'liga', 'pagina'].some((k) => sp[k] != null && sp[k] !== '');
  return {
    title: { absolute: 'Fichajes de fútbol: rumores y confirmados | FutStats' },
    description:
      'Mercado de fichajes: traspasos y cesiones confirmados por club y liga, más rumores de medios claramente etiquetados.',
    alternates: { canonical: '/fichajes' },
    ...(hasFilters ? { robots: { index: false } } : {}),
  };
}

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string; tipo?: string; liga?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const club = (sp.club ?? '').slice(0, 60);
  const tipo = TRANSFER_TYPE_LABELS[sp.tipo ?? ''] != null ? sp.tipo! : '';
  const liga = (sp.liga ?? '').slice(0, 50);
  const pagina = Math.max(1, Number(sp.pagina ?? 1) || 1);

  const clubFilter: Prisma.TeamWhereInput | undefined =
    club !== '' || liga !== ''
      ? {
          ...(club !== '' ? { slug: club } : {}),
          ...(liga !== '' ? { seasons: { some: { season: { competition: { slug: liga }, isCurrent: true } } } } : {}),
        }
      : undefined;

  const where: Prisma.TransferWhereInput = {
    ...(tipo !== '' ? { type: tipo } : {}),
    ...(clubFilter != null ? { OR: [{ toTeam: clubFilter }, { fromTeam: clubFilter }] } : {}),
  };

  const [leagues, clubs, total, transfers, rumors, marketByClub] = await Promise.all([
    prisma.competition.findMany({ where: { type: 'LEAGUE' }, orderBy: { name: 'asc' } }),
    prisma.team.findMany({ where: { isNational: false, seasons: { some: {} } }, select: { slug: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.transfer.count({ where }),
    prisma.transfer.findMany({
      where,
      include: {
        player: { select: { slug: true } },
        fromTeam: { select: { name: true, slug: true } },
        toTeam: { select: { name: true, slug: true } },
      },
      orderBy: { date: 'desc' },
      skip: (pagina - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.newsItem.findMany({
      where: {
        category: { in: ['rumores', 'fichajes'] },
        // Solo mercado reciente: un rumor antiguo ya no es información útil
        publishedAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      },
      include: { team: { select: { name: true, slug: true } } },
      orderBy: { publishedAt: 'desc' },
      take: 6,
    }),
    prisma.transfer.groupBy({
      by: ['toTeamId'],
      where: { toTeamId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { toTeamId: 'desc' } },
      take: 6,
    }),
  ]);

  const topClubIds = marketByClub.map((m) => m.toTeamId).filter((x): x is number => x != null);
  const topClubs = await prisma.team.findMany({ where: { id: { in: topClubIds } }, select: { id: true, name: true, slug: true } });
  const clubName = (id: number | null) => topClubs.find((c) => c.id === id);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = club !== '' || tipo !== '' || liga !== '';
  const qs = new URLSearchParams();
  if (club !== '') qs.set('club', club);
  if (tipo !== '') qs.set('tipo', tipo);
  if (liga !== '') qs.set('liga', liga);
  const pageHref = (n: number) => {
    const p = new URLSearchParams(qs);
    if (n > 1) p.set('pagina', String(n));
    const s = p.toString();
    return s === '' ? '/fichajes' : `/fichajes?${s}`;
  };
  const status = TRANSFER_STATUS.CONFIRMADO!;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Fichajes' }]} />
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">Mercado de fichajes</h1>
        <p className="mt-1 max-w-2xl text-sm text-pitch-muted">
          Movimientos confirmados registrados por API-Football desde junio de 2025, y rumores de
          medios claramente etiquetados como tales. Nunca se presentan rumores como hechos.
        </p>
      </div>

      {/* Filtros */}
      <form method="GET" action="/fichajes" className="grid grid-cols-2 items-end gap-3 text-sm sm:flex sm:flex-wrap">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-pitch-muted">Liga</span>
          <select name="liga" defaultValue={liga} className="w-full rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 sm:w-auto">
            <option value="">Todas</option>
            {leagues.map((l) => <option key={l.id} value={l.slug}>{l.name}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-pitch-muted">Club</span>
          <select name="club" defaultValue={club} className="w-full rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 sm:max-w-40">
            <option value="">Todos</option>
            {clubs.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-pitch-muted">Tipo de operación</span>
          <select name="tipo" defaultValue={tipo} className="w-full rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 sm:w-auto">
            <option value="">Todos</option>
            {Object.entries(TRANSFER_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="w-full rounded-lg bg-pitch-accent px-4 py-2 font-medium text-black sm:w-auto">
          Filtrar
        </button>
        {hasFilters && (
          <Link href="/fichajes" className="col-span-2 w-full rounded-lg border border-pitch-border px-4 py-2 text-center text-pitch-muted hover:text-white sm:col-auto sm:w-auto">
            Limpiar
          </Link>
        )}
      </form>

      <p className="text-sm text-pitch-muted" role="status">
        {total.toLocaleString('es-ES')} {total === 1 ? 'operación confirmada' : 'operaciones confirmadas'}
        {totalPages > 1 && ` · página ${pagina} de ${totalPages}`}
      </p>

      {/* Fichajes confirmados */}
      <section aria-label="Fichajes confirmados" className="space-y-2">
        {transfers.map((t) => {
          const fee = feeLabel(t.fee);
          return (
            <article key={t.id} className="fs-panel p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`} title={status.explanation}>
                  {status.prefix} {status.label}
                </span>
                <span className="rounded-full bg-pitch-border/60 px-2 py-0.5 text-xs text-pitch-muted">
                  {TRANSFER_TYPE_LABELS[t.type] ?? t.type}
                </span>
                <time dateTime={t.date.toISOString()} className="text-xs text-pitch-muted">
                  {t.date.toLocaleDateString('es-ES', { dateStyle: 'medium' })}
                </time>
                <span className="w-full text-xs text-pitch-muted sm:ml-auto sm:w-auto">Fuente: API-Football · act. {timeAgo(t.updatedAt)}</span>
              </div>
              <p className="mt-2 font-semibold">
                {t.player != null ? (
                  <Link href={`/jugadores/${t.player.slug}`} className="hover:text-pitch-accent">{t.playerName}</Link>
                ) : (
                  t.playerName
                )}
              </p>
              <p className="mt-1 text-pitch-muted">
                {t.fromTeam != null ? (
                  <Link href={`/equipos/${t.fromTeam.slug}`} className="hover:text-pitch-accent">{t.fromTeam.name}</Link>
                ) : (t.fromName ?? 'Origen no registrado')}
                {' → '}
                {t.toTeam != null ? (
                  <Link href={`/equipos/${t.toTeam.slug}`} className="hover:text-pitch-accent">{t.toTeam.name}</Link>
                ) : (t.toName ?? 'Destino no registrado')}
                {' · '}
                <span title={fee.note}>{fee.text}</span>
                {fee.note !== '' && <span className="text-xs"> ({fee.note.toLowerCase()})</span>}
              </p>
            </article>
          );
        })}
        {transfers.length === 0 && (
          <div className="rounded-xl border border-dashed border-pitch-border p-8 text-center text-sm text-pitch-muted">
            <p className="font-medium text-white">Sin operaciones con estos filtros.</p>
            <p className="mt-1">Los movimientos se sincronizan automáticamente club a club cada 24 horas.</p>
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <nav aria-label="Paginación de fichajes" className="flex items-center justify-center gap-4 text-sm">
          {pagina > 1 ? (
            <Link rel="prev" className="rounded px-3 py-2 text-pitch-accent hover:underline" href={pageHref(pagina - 1)}>← Anteriores</Link>
          ) : <span aria-hidden="true" className="px-3 py-2 text-pitch-border">← Anteriores</span>}
          <span className="text-pitch-muted">Página {pagina} de {totalPages}</span>
          {pagina < totalPages ? (
            <Link rel="next" className="rounded px-3 py-2 text-pitch-accent hover:underline" href={pageHref(pagina + 1)}>Siguientes →</Link>
          ) : <span aria-hidden="true" className="px-3 py-2 text-pitch-border">Siguientes →</span>}
        </nav>
      )}

      {/* Rumores destacados */}
      {rumors.length > 0 && pagina === 1 && !hasFilters && (
        <section aria-label="Rumores destacados">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Rumores y mercado en los medios</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {rumors.map((n) => (
              <a key={n.id} href={n.url} rel="noopener noreferrer" target="_blank"
                className="fs-panel p-3 text-sm hover:border-pitch-accent">
                <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                  n.category === 'rumores' ? 'bg-yellow-500/15 text-yellow-300' : 'bg-pitch-border/60 text-pitch-muted'
                }`}>
                  {n.category === 'rumores' ? '? Rumor' : CATEGORY_LABELS[n.category]}
                </span>
                {n.title}
                <span className="mt-1 block text-xs text-pitch-muted">{n.source} · {timeAgo(n.publishedAt)}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Mercado por club */}
      {topClubIds.length > 0 && pagina === 1 && !hasFilters && (
        <section aria-label="Mercado por club">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Clubes con más movimientos</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {marketByClub.map((m) => {
              const c = clubName(m.toTeamId);
              if (c == null) return null;
              return (
                <Link key={c.id} href={`/fichajes?club=${c.slug}`}
                  className="rounded-full border border-pitch-border px-4 py-1.5 text-pitch-muted hover:border-pitch-accent hover:text-white">
                  {c.name} · {m._count._all}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
