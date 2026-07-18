import { prisma, type Prisma } from '@futstats/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LiveNews } from '@/components/LiveNews';
import { CATEGORY_LABELS, timeAgo } from '@/lib/marketLabels';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const hasFilters = ['categoria', 'liga', 'club', 'q', 'fecha', 'pagina'].some((k) => sp[k] != null && sp[k] !== '');
  return {
    title: { absolute: 'Noticias de fútbol y última hora | FutStats' },
    description:
      'Consulta las últimas noticias de fútbol, fichajes confirmados, rumores y movimientos del mercado por jugador, club y liga.',
    alternates: { canonical: '/noticias' },
    // Los filtros generan combinaciones duplicadas: solo se indexa el feed base
    ...(hasFilters ? { robots: { index: false } } : {}),
  };
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; liga?: string; club?: string; q?: string; fecha?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const categoria = CATEGORY_LABELS[sp.categoria ?? ''] != null ? sp.categoria! : '';
  const liga = (sp.liga ?? '').slice(0, 50);
  const club = (sp.club ?? '').slice(0, 60);
  const q = (sp.q ?? '').slice(0, 80).trim();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha ?? '') ? sp.fecha! : '';
  const pagina = Math.max(1, Number(sp.pagina ?? 1) || 1);

  const where: Prisma.NewsItemWhereInput = {
    ...(categoria !== '' ? { category: categoria } : {}),
    ...(club !== '' ? { team: { slug: club } } : {}),
    ...(liga !== ''
      ? { team: { ...(club !== '' ? { slug: club } : {}), seasons: { some: { season: { competition: { slug: liga }, isCurrent: true } } } } }
      : {}),
    ...(q !== '' ? { title: { contains: q, mode: 'insensitive' } } : {}),
    ...(fecha !== ''
      ? { publishedAt: { gte: new Date(`${fecha}T00:00:00Z`), lt: new Date(`${fecha}T23:59:59Z`) } }
      : {}),
  };

  const [leagues, clubs, total, items, latest] = await Promise.all([
    prisma.competition.findMany({ where: { type: 'LEAGUE' }, orderBy: { name: 'asc' } }),
    prisma.team.findMany({ where: { isNational: false, news: { some: {} } }, select: { slug: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.newsItem.count({ where }),
    prisma.newsItem.findMany({
      where,
      include: {
        team: { select: { name: true, slug: true } },
        player: { select: { knownAs: true, fullName: true, slug: true } },
      },
      orderBy: { publishedAt: 'desc' },
      skip: (pagina - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.newsItem.findMany({ orderBy: { publishedAt: 'desc' }, take: 4, select: { id: true, title: true, url: true, source: true, publishedAt: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = categoria !== '' || liga !== '' || club !== '' || q !== '' || fecha !== '';

  const qs = new URLSearchParams();
  if (categoria !== '') qs.set('categoria', categoria);
  if (liga !== '') qs.set('liga', liga);
  if (club !== '') qs.set('club', club);
  if (q !== '') qs.set('q', q);
  if (fecha !== '') qs.set('fecha', fecha);
  const pageHref = (n: number) => {
    const p = new URLSearchParams(qs);
    if (n > 1) p.set('pagina', String(n));
    const s = p.toString();
    return s === '' ? '/noticias' : `/noticias?${s}`;
  };

  const itemListJsonLd =
    items.length > 0 && !hasFilters
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Noticias de fútbol y última hora',
          itemListElement: items.slice(0, 10).map((n, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: n.title,
            url: n.url,
          })),
        }
      : null;

  return (
    <div className="space-y-6">
      {itemListJsonLd != null && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}
      <Breadcrumbs items={[{ label: 'Noticias' }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Noticias de fútbol</h1>
          <p className="mt-1 max-w-2xl text-sm text-pitch-muted">
            Titulares de medios deportivos reconocidos con enlace a la fuente original. Los rumores
            se etiquetan siempre como rumores.
          </p>
        </div>
        <LiveNews serverNow={new Date().toISOString()} />
      </div>

      {/* Última hora */}
      {latest.length > 0 && pagina === 1 && !hasFilters && (
        <section aria-label="Última hora" className="rounded-xl border border-pitch-accent/40 bg-pitch-accent/5 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-pitch-accent">Última hora</h2>
          <ul className="space-y-1 text-sm">
            {latest.map((n) => (
              <li key={n.id}>
                <a href={n.url} rel="noopener noreferrer" target="_blank" className="hover:text-pitch-accent hover:underline">
                  {n.title}
                </a>{' '}
                <span className="text-xs text-pitch-muted">— {n.source}, {timeAgo(n.publishedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Filtros */}
      <form method="GET" action="/noticias" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Buscar</span>
          <input type="search" name="q" defaultValue={q} placeholder="palabra clave"
            className="w-full min-w-0 rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 outline-none focus:border-pitch-accent focus:ring-2 focus:ring-pitch-accent/40 sm:w-44" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Categoría</span>
          <select name="categoria" defaultValue={categoria} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
            <option value="">Todas</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Liga</span>
          <select name="liga" defaultValue={liga} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
            <option value="">Todas</option>
            {leagues.map((l) => <option key={l.id} value={l.slug}>{l.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Club</span>
          <select name="club" defaultValue={club} className="max-w-40 rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
            <option value="">Todos</option>
            {clubs.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Fecha</span>
          <input type="date" name="fecha" defaultValue={fecha} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2" />
        </label>
        <button type="submit" className="rounded-lg bg-pitch-accent px-4 py-2 font-medium text-black">Filtrar</button>
        {hasFilters && (
          <Link href="/noticias" className="rounded-lg border border-pitch-border px-4 py-2 text-pitch-muted hover:text-white">
            Limpiar
          </Link>
        )}
      </form>

      <p className="text-sm text-pitch-muted" role="status">
        {total.toLocaleString('es-ES')} {total === 1 ? 'noticia' : 'noticias'}
        {totalPages > 1 && ` · página ${pagina} de ${totalPages}`}
      </p>

      {/* Feed */}
      <div className="space-y-3">
        {items.map((n) => (
          <article key={n.id} className="flex gap-4 rounded-xl border border-pitch-border bg-pitch-card p-4">
            {n.imageUrl != null && (
              // eslint-disable-next-line @next/next/no-img-element
              <img width={96} height={64} loading="lazy" decoding="async" src={n.imageUrl} alt=""
                className="hidden h-16 w-24 shrink-0 rounded-lg object-cover sm:block" />
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-medium ${
                  n.category === 'rumores' ? 'bg-yellow-500/15 text-yellow-300'
                  : n.category === 'confirmados' ? 'bg-pitch-accent/15 text-pitch-accent'
                  : 'bg-pitch-border/60 text-pitch-muted'
                }`}>
                  {n.category === 'rumores' ? '? ' : n.category === 'confirmados' ? '✓ ' : ''}
                  {CATEGORY_LABELS[n.category] ?? n.category}
                </span>
                <span className="text-pitch-muted">{n.source}</span>
                <time dateTime={n.publishedAt.toISOString()} className="text-pitch-muted">
                  {n.publishedAt.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                </time>
              </div>
              <h2 className="text-sm font-semibold leading-snug">
                <a href={n.url} rel="noopener noreferrer" target="_blank" className="hover:text-pitch-accent">
                  {n.title}
                </a>
              </h2>
              {n.summary != null && <p className="mt-1 line-clamp-2 text-xs text-pitch-muted">{n.summary}</p>}
              {(n.team != null || n.player != null) && (
                <p className="mt-2 flex flex-wrap gap-2 text-xs">
                  {n.player != null && (
                    <Link href={`/jugadores/${n.player.slug}`} className="rounded-full border border-pitch-border px-2 py-0.5 text-pitch-muted hover:border-pitch-accent hover:text-white">
                      {n.player.knownAs ?? n.player.fullName}
                    </Link>
                  )}
                  {n.team != null && (
                    <Link href={`/equipos/${n.team.slug}`} className="rounded-full border border-pitch-border px-2 py-0.5 text-pitch-muted hover:border-pitch-accent hover:text-white">
                      {n.team.name}
                    </Link>
                  )}
                </p>
              )}
            </div>
          </article>
        ))}
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-pitch-border p-8 text-center text-sm text-pitch-muted">
            <p className="font-medium text-white">Sin noticias con estos filtros.</p>
            <p className="mt-1">El feed se alimenta automáticamente cada hora desde los medios configurados.</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Paginación de noticias" className="flex items-center justify-center gap-4 text-sm">
          {pagina > 1 ? (
            <Link rel="prev" className="rounded px-3 py-2 text-pitch-accent hover:underline" href={pageHref(pagina - 1)}>← Anteriores</Link>
          ) : (
            <span aria-hidden="true" className="px-3 py-2 text-pitch-border">← Anteriores</span>
          )}
          <span className="text-pitch-muted">Página {pagina} de {totalPages}</span>
          {pagina < totalPages ? (
            <Link rel="next" className="rounded px-3 py-2 text-pitch-accent hover:underline" href={pageHref(pagina + 1)}>Siguientes →</Link>
          ) : (
            <span aria-hidden="true" className="px-3 py-2 text-pitch-border">Siguientes →</span>
          )}
        </nav>
      )}

      <p className="text-xs text-pitch-muted">
        FutStats agrega titulares con enlace directo al medio original; el contenido completo
        pertenece a cada fuente. Fichajes confirmados en la sección{' '}
        <Link href="/fichajes" className="text-pitch-accent hover:underline">Fichajes</Link>.
      </p>
    </div>
  );
}
