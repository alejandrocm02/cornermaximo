import { prisma } from '@futstats/db';
import { BIG_FIVE_CURRENT_SEASON, BIG_FIVE_PREVIOUS_SEASON, WORLD_CUP_2026 } from '@futstats/shared';
import Link from 'next/link';
import { MatchRows } from '@/components/MatchRows';
import { SearchBox } from '@/components/SearchBox';
import { SectionHeader } from '@/components/SectionHeader';
import { seasonLabel } from '@/lib/football';
import { topLeaguePlayers } from '@/lib/leaderboards';
import { topPlayerStat } from '@/lib/worldCupStats';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: { absolute: 'Estadísticas de jugadores, rankings y resultados | FutStats' },
  description:
    'Consulta estadísticas, rankings y rendimiento de más de 4.000 futbolistas. Compara jugadores y sigue el Mundial 2026.',
  alternates: { canonical: '/' },
};

/** Redondea hacia abajo a la centena para un claim veraz ("más de X"). */
function roundedCount(n: number): string {
  const rounded = Math.max(100, Math.floor(n / 100) * 100);
  return rounded.toLocaleString('es-ES');
}

const QUICK_ACTIONS = [
  { href: '/noticias', title: 'Noticias y mercado', desc: 'Última hora, rumores etiquetados y fichajes confirmados.' },
  { href: '/jugadores', title: 'Buscar jugadores', desc: 'Directorio completo con filtros por posición y liga.' },
  { href: '/comparador', title: 'Comparar futbolistas', desc: 'Dos jugadores frente a frente en sus últimos 5 partidos.' },
  { href: '/rankings', title: 'Rankings', desc: 'Goles, asistencias, paradas y más, por liga y temporada.' },
  { href: '/mundial-2026', title: 'Mundial 2026', desc: 'Grupos, eliminatorias y estadísticas del torneo.' },
];

export default async function HomePage() {
  const [playersCount, topScorers, topAssists, topSaves, latestNews, recentMatches, upcomingMatches, wcScorers] =
    await Promise.all([
      prisma.player.count(),
      topLeaguePlayers('goals', 6),
      topLeaguePlayers('assists', 5),
      topLeaguePlayers('saves', 5),
      prisma.newsItem.findMany({ orderBy: { publishedAt: 'desc' }, take: 4, select: { id: true, title: true, url: true, source: true, publishedAt: true } }),
      prisma.match.findMany({
        where: { status: 'FINISHED' },
        include: {
          teams: { include: { team: { select: { name: true, slug: true } } } },
          season: { include: { competition: { select: { name: true, slug: true } } } },
        },
        orderBy: { kickoffAt: 'desc' },
        take: 5,
      }),
      prisma.match.findMany({
        where: { status: 'SCHEDULED', kickoffAt: { gte: new Date() } },
        include: {
          teams: { include: { team: { select: { name: true, slug: true } } } },
          season: { include: { competition: { select: { name: true, slug: true } } } },
        },
        orderBy: { kickoffAt: 'asc' },
        take: 5,
      }),
      topPlayerStat(WORLD_CUP_2026.slug, 'goals', 3),
    ]);

  return (
    <div className="space-y-14 sm:space-y-20">
      {/* 1. Hero y buscador */}
      <section className="relative isolate -mt-4 overflow-hidden rounded-4xl border border-pitch-border/70 px-4 py-12 text-center sm:px-8 sm:py-16">
        {/* Capas decorativas: rejilla técnica + halo de marca. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(rgb(var(--pitch-border-strong)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--pitch-border-strong)) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(70% 70% at 50% 30%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(70% 70% at 50% 30%, black, transparent)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-[42rem] max-w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pitch-accent/20 blur-3xl"
        />

        <p className="fs-eyebrow justify-center">
          <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-pitch-accent" />
          Temporadas {seasonLabel(BIG_FIVE_PREVIOUS_SEASON)} y {seasonLabel(BIG_FIVE_CURRENT_SEASON)} · Mundial 2026
        </p>

        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          Compara el rendimiento de más de{' '}
          <span className="fs-gradient-text">{roundedCount(playersCount)} futbolistas</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-sm text-pitch-muted sm:text-base">
          Consulta estadísticas, rankings y resultados de las principales ligas y del Mundial 2026,
          con datos actualizados automáticamente.
        </p>

        <div className="mt-8 flex justify-center">
          <SearchBox />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/jugadores" className="fs-btn-primary">
            Buscar jugador
          </Link>
          <Link href="/comparador" className="fs-btn-ghost">
            Comparar futbolistas
          </Link>
        </div>
      </section>

      {/* 2. Acciones rápidas */}
      <section>
        <SectionHeader eyebrow="Empieza por aquí" title="Acciones rápidas" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className="fs-panel-interactive group flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-white">{a.title}</p>
                <p className="mt-1 text-xs text-pitch-muted">{a.desc}</p>
              </div>
              <span
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-pitch-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-pitch-accent"
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 2.5 Actualidad */}
      {latestNews.length > 0 && (
        <section>
          <SectionHeader eyebrow="Última hora" title="Actualidad" action={{ href: '/noticias', label: 'Todas las noticias' }} />
          <ul className="fs-panel divide-y divide-pitch-border/60">
            {latestNews.map((n) => (
              <li key={n.id}>
                <a
                  href={n.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-pitch-elevated/40"
                >
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pitch-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="text-pitch-subtle transition-colors hover:text-white">{n.title}</span>
                    <span className="mt-0.5 block text-2xs text-pitch-muted">{n.source}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3. Jugadores destacados */}
      <section>
        <SectionHeader eyebrow="En forma" title="Máximos goleadores" action={{ href: '/rankings', label: 'Ver rankings' }} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topScorers.map((p, i) => (
            <Link key={p.slug} href={`/jugadores/${p.slug}`} className="fs-panel-interactive flex items-center gap-3 p-3">
              <span className="relative shrink-0">
                {p.photoUrl != null ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    width={52}
                    height={52}
                    loading="lazy"
                    decoding="async"
                    src={p.photoUrl}
                    alt=""
                    className="h-[3.25rem] w-[3.25rem] rounded-full object-cover ring-1 ring-pitch-border"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="block h-[3.25rem] w-[3.25rem] rounded-full bg-pitch-elevated ring-1 ring-pitch-border"
                  />
                )}
                {/* Dorsal de posición en el ranking. */}
                <span className="absolute -bottom-1 -left-1 grid h-5 w-5 place-items-center rounded-full bg-pitch-elevated font-display text-2xs font-bold text-pitch-subtle ring-1 ring-pitch-border">
                  {i + 1}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{p.name}</span>
                <span className="block truncate text-xs text-pitch-muted">{p.team ?? '—'}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="fs-stat block leading-none text-pitch-accent">{p.total}</span>
                <span className="mt-0.5 block text-2xs uppercase tracking-wide text-pitch-muted">goles</span>
              </span>
            </Link>
          ))}
          {topScorers.length === 0 && (
            <p className="fs-panel col-span-full px-4 py-8 text-center text-sm text-pitch-muted">
              Los destacados aparecerán al sincronizar estadísticas.
            </p>
          )}
        </div>
      </section>

      {/* 4. Rankings principales */}
      <section>
        <SectionHeader eyebrow="Líderes" title="Rankings principales" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(
            [
              { title: 'Asistencias', rows: topAssists, metric: 'assists' },
              { title: 'Paradas', rows: topSaves, metric: 'saves' },
              {
                title: 'Goles (Mundial 2026)',
                rows: wcScorers.map((r) => ({ slug: r.slug, name: r.name, team: r.team, total: r.total })),
                metric: null,
              },
            ] as const
          ).map((block) => (
            <div key={block.title} className="fs-panel flex flex-col overflow-hidden">
              <p className="border-b border-pitch-border/60 bg-pitch-elevated/40 px-4 py-2.5 text-2xs font-semibold uppercase tracking-[0.18em] text-pitch-muted">
                {block.title}
              </p>
              <ul className="flex-1 divide-y divide-pitch-border/40">
                {block.rows.map((r, i) => (
                  <li key={r.slug}>
                    <Link
                      href={`/jugadores/${r.slug}`}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-pitch-elevated/50"
                    >
                      <span className="w-4 shrink-0 font-display text-2xs font-bold tabular-nums text-pitch-muted">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-pitch-subtle">{r.name}</span>
                      <span className="hidden shrink-0 truncate text-2xs text-pitch-muted xs:block">{r.team ?? ''}</span>
                      <span className="shrink-0 font-display font-bold tabular-nums text-pitch-accent">{r.total}</span>
                    </Link>
                  </li>
                ))}
                {block.rows.length === 0 && (
                  <li className="px-4 py-6 text-center text-xs text-pitch-muted">Sin datos todavía.</li>
                )}
              </ul>
              {block.metric != null && (
                <Link
                  href={`/rankings?metric=${block.metric}`}
                  className="border-t border-pitch-border/60 px-4 py-2.5 text-2xs font-medium text-pitch-accent transition-colors hover:bg-pitch-elevated/50 hover:text-white"
                >
                  Ver completo <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 5. Partidos recientes y próximos */}
      <section className="grid gap-8 lg:grid-cols-2 lg:gap-6">
        <div>
          <SectionHeader eyebrow="Resultados" title="Últimos partidos" />
          <MatchRows matches={recentMatches} empty="Sin partidos sincronizados todavía." />
        </div>
        <div>
          <SectionHeader eyebrow="Calendario" title="Próximos partidos" />
          <MatchRows matches={upcomingMatches} empty="Sin partidos programados en la base de datos." />
        </div>
      </section>

      {/* 6. Mundial 2026 */}
      <section>
        <Link
          href="/mundial-2026"
          className="group relative isolate block overflow-hidden rounded-4xl border border-pitch-accent/30 p-6 transition duration-200 hover:border-pitch-accent/60 sm:p-10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-grad-brand opacity-[0.12] transition-opacity duration-200 group-hover:opacity-[0.18]"
          />
          <p className="fs-eyebrow">
            <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-pitch-accent" />
            Mundial 2026 · En juego
          </p>
          <h2 className="mt-2 max-w-2xl text-2xl font-bold sm:text-3xl">
            Grupos, eliminatorias y estadísticas del torneo
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-pitch-muted">
            48 selecciones con estadísticas individuales y colectivas partido a partido.
            {wcScorers.length > 0 && (
              <>
                {' '}
                Pichichi actual: <span className="font-semibold text-white">{wcScorers[0]!.name}</span> con{' '}
                {wcScorers[0]!.total} goles.
              </>
            )}
          </p>
          <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-pitch-accent">
            Abrir sección
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </p>
        </Link>
      </section>

      {/* 7. Cobertura y fuente de datos */}
      <section className="fs-panel p-5 sm:p-6">
        <h2 className="fs-eyebrow">Cobertura</h2>
        <p className="mt-2 text-sm text-pitch-muted">
          LaLiga, Premier League, Serie A, Bundesliga y Ligue 1 — temporadas {seasonLabel(BIG_FIVE_PREVIOUS_SEASON)} y{' '}
          {seasonLabel(BIG_FIVE_CURRENT_SEASON)} — más el Mundial 2026 completo. Estadísticas por jugador y partido de
          API-Football, sincronizadas automáticamente cada hora.
        </p>
      </section>
    </div>
  );
}
