import { prisma } from '@cornermaximo/db';
import { BIG_FIVE_CURRENT_SEASON, WORLD_CUP_2026 } from '@cornermaximo/shared';
import Link from 'next/link';
import { LiveScoreboardController } from '@/components/LiveScoreboardController';
import { MatchRows } from '@/components/MatchRows';
import { SearchBox } from '@/components/SearchBox';
import { SectionHeader } from '@/components/SectionHeader';
import { seasonLabel } from '@/lib/football';
import { topLeaguePlayers } from '@/lib/leaderboards';
import { topPlayerStat } from '@/lib/worldCupStats';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: { absolute: 'CornerMaximo | Sports Intelligence' },
  description: 'Livescore, estadísticas de la temporada actual, scouting, rankings y actualidad del fútbol en una plataforma deportiva de inteligencia.',
  alternates: { canonical: '/' },
};

function roundedCount(n: number): string {
  return Math.max(100, Math.floor(n / 100) * 100).toLocaleString('es-ES');
}

const TOOLS = [
  { href: '/scouting', code: 'SCOUT', title: 'CM Scout', desc: 'Encuentra perfiles por rendimiento, posición y contexto.' },
  { href: '/comparador', code: 'VS', title: 'Comparador', desc: 'Enfrenta futbolistas y métricas por 90 minutos.' },
  { href: '/rankings', code: 'TOP', title: 'Rankings', desc: 'Podios y líderes de la temporada vigente.' },
  { href: '/analizador', code: 'AI', title: 'Analizador', desc: 'Convierte datos del partido en una lectura accionable.' },
  { href: '/fichajes', code: 'MKT', title: 'Mercado', desc: 'Movimientos y contexto de fichajes.' },
  { href: '/mi-corner', code: 'MY', title: 'Mi Corner', desc: 'Tus equipos, jugadores, alertas y watchlists.' },
] as const;

export default async function HomePage() {
  const now = new Date();
  const [
    playersCount,
    liveMatches,
    upcomingMatches,
    recentMatches,
    topScorers,
    topAssists,
    topSaves,
    latestNews,
    wcScorers,
  ] = await Promise.all([
    prisma.player.count(),
    prisma.match.findMany({
      where: { status: 'LIVE', season: { isCurrent: true } },
      include: {
        teams: { include: { team: { select: { name: true, slug: true } } } },
        season: { include: { competition: { select: { name: true, slug: true } } } },
      },
      orderBy: { kickoffAt: 'asc' },
      take: 8,
    }),
    prisma.match.findMany({
      where: { status: 'SCHEDULED', kickoffAt: { gte: now }, season: { isCurrent: true } },
      include: {
        teams: { include: { team: { select: { name: true, slug: true } } } },
        season: { include: { competition: { select: { name: true, slug: true } } } },
      },
      orderBy: { kickoffAt: 'asc' },
      take: 6,
    }),
    prisma.match.findMany({
      where: { status: 'FINISHED', season: { isCurrent: true } },
      include: {
        teams: { include: { team: { select: { name: true, slug: true } } } },
        season: { include: { competition: { select: { name: true, slug: true } } } },
      },
      orderBy: { kickoffAt: 'desc' },
      take: 6,
    }),
    topLeaguePlayers('goals', 5),
    topLeaguePlayers('assists', 5),
    topLeaguePlayers('saves', 5),
    prisma.newsItem.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: { id: true, title: true, url: true, source: true, publishedAt: true },
    }),
    topPlayerStat(WORLD_CUP_2026.slug, 'goals', 3),
  ]);

  const currentLabel = seasonLabel(BIG_FIVE_CURRENT_SEASON);
  const hasLive = liveMatches.length > 0;

  return (
    <div className="cm-page space-y-8">
      {hasLive && <LiveScoreboardController />}
      <section className="cm-hero-panel z-30 overflow-visible p-5 sm:p-7 lg:p-8">
        <div className="relative z-10 grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)] xl:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="cm-kicker">Sports Intelligence</span>
              <span className="cm-data-pill">Temporada {currentLabel}</span>
              {hasLive && <span className="cm-live-dot"><span aria-hidden="true" /> {liveMatches.length} en directo</span>}
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-bold leading-[1.04] sm:text-5xl lg:text-6xl">
              El fútbol de hoy, <span className="fs-gradient-text">convertido en ventaja.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-pitch-muted sm:text-base">
              Livescore, rendimiento, scouting y contexto en una sola superficie. Más de {roundedCount(playersCount)} futbolistas y estadísticas separadas por temporada real.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/partidos" className="fs-btn-primary">Abrir Match Center</Link>
              <Link href="/rankings" className="fs-btn-ghost">Rankings {currentLabel}</Link>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-pitch-muted">Búsqueda universal</p>
            <SearchBox />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="cm-kpi"><span>Jugadores</span><strong>{roundedCount(playersCount)}+</strong></div>
              <div className="cm-kpi"><span>Live</span><strong>{liveMatches.length}</strong></div>
              <div className="cm-kpi"><span>Season</span><strong>{currentLabel}</strong></div>
            </div>
          </div>
        </div>
      </section>

      {hasLive && (
        <section>
          <SectionHeader eyebrow="Live Center" title="Ahora en juego" action={{ href: '/partidos', label: 'Todos los partidos' }} />
          <div className="rounded-2xl border border-pitch-danger/25 bg-pitch-danger/[.035] p-1 shadow-[0_0_40px_-25px_rgba(255,62,82,.55)]">
            <MatchRows matches={liveMatches} empty="No hay partidos en directo." />
          </div>
        </section>
      )}

      <section className="cm-dashboard-grid">
        <div className="lg:col-span-7">
          <SectionHeader eyebrow="Match Center" title="Calendario y resultados" action={{ href: '/partidos', label: 'Abrir calendario' }} />
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-pitch-muted">Próximos</p>
              <MatchRows matches={upcomingMatches} empty="Sin próximos partidos sincronizados." />
            </div>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-pitch-muted">Últimos resultados</p>
              <MatchRows matches={recentMatches} empty="Aún no hay resultados de esta temporada." />
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <SectionHeader eyebrow={`Rankings · ${currentLabel}`} title="Líderes actuales" action={{ href: '/rankings', label: 'Centro de rankings' }} />
          <div className="cm-dashboard-card">
            <div className="grid grid-cols-3 border-b border-pitch-border/60 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-pitch-muted">
              <span className="border-r border-pitch-border/60 py-3">Goles</span><span className="border-r border-pitch-border/60 py-3">Asist.</span><span className="py-3">Paradas</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-pitch-border/60">
              {[topScorers, topAssists, topSaves].map((ranking, column) => (
                <ol key={column} className="min-w-0">
                  {ranking.slice(0, 5).map((player, index) => (
                    <li key={`${player.slug}-${column}`} className="border-b border-pitch-border/45 last:border-0">
                      <Link href={`/jugadores/${player.slug}`} className="flex min-h-[58px] items-center gap-2 px-2.5 py-2 transition hover:bg-pitch-elevated/35 sm:px-3">
                        <span className={`cm-table-rank ${index < 3 ? `cm-rank-${index + 1}` : ''}`}>{index + 1}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-white">{player.name}</span><span className="block truncate text-[9px] text-pitch-muted">{player.team ?? '—'}</span></span>
                        <strong className="font-display text-sm tabular-nums text-pitch-accent">{player.total}</strong>
                      </Link>
                    </li>
                  ))}
                  {ranking.length === 0 && <li className="p-4 text-center text-[10px] text-pitch-muted">Esperando datos {currentLabel}</li>}
                </ol>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Intelligence Stack" title="Herramientas de análisis" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {TOOLS.map((tool) => (
            <Link key={tool.href} href={tool.href} className="fs-panel-interactive group min-h-40 p-4">
              <span className="cm-data-pill font-display font-bold text-pitch-accent">{tool.code}</span>
              <h2 className="mt-5 font-display text-base font-bold text-white group-hover:text-pitch-accent">{tool.title}</h2>
              <p className="mt-2 text-xs leading-5 text-pitch-muted">{tool.desc}</p>
              <span aria-hidden="true" className="absolute bottom-4 right-4 text-pitch-muted transition group-hover:translate-x-1 group-hover:text-pitch-accent">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="cm-dashboard-grid">
        <div className="lg:col-span-7">
          <SectionHeader eyebrow="Última hora" title="Noticias" action={{ href: '/noticias', label: 'Ver actualidad' }} />
          <div className="cm-dashboard-card divide-y divide-pitch-border/55">
            {latestNews.map((news, index) => (
              <a key={news.id} href={news.url} target="_blank" rel="noopener noreferrer" className="group grid gap-2 px-4 py-4 transition hover:bg-pitch-elevated/30 sm:grid-cols-[2rem_1fr_auto] sm:items-center">
                <span className="font-display text-xs font-bold tabular-nums text-pitch-muted">{String(index + 1).padStart(2, '0')}</span>
                <span className="text-sm font-medium text-pitch-subtle group-hover:text-white">{news.title}</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-pitch-muted">{news.source}</span>
              </a>
            ))}
            {latestNews.length === 0 && <p className="p-6 text-sm text-pitch-muted">Sin noticias sincronizadas.</p>}
          </div>
        </div>

        <div className="lg:col-span-5">
          <SectionHeader eyebrow="Archivo especial" title="Mundial 2026" action={{ href: '/mundial-2026', label: 'Abrir hub' }} />
          <Link href="/mundial-2026" className="cm-hero-panel block min-h-[250px] overflow-hidden p-5 transition hover:border-pitch-accent/45">
            <p className="cm-kicker">Tournament Intelligence</p>
            <h2 className="mt-4 text-2xl font-bold">Grupos, eliminatorias y rendimiento.</h2>
            <p className="mt-3 text-sm leading-6 text-pitch-muted">El Mundial mantiene su temporada propia y no se mezcla con los rankings de clubes.</p>
            {wcScorers.length > 0 && <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-widest text-pitch-muted">Máximo goleador</p><p className="mt-1 font-display text-lg font-bold text-white">{wcScorers[0]!.name}</p><p className="text-sm text-pitch-accent">{wcScorers[0]!.total} goles</p></div>}
          </Link>
        </div>
      </section>
    </div>
  );
}
