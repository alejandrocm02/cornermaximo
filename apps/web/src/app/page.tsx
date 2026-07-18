import { prisma } from '@futstats/db';
import { CURRENT_SEASON, RECENT_SEASON, WORLD_CUP_2026 } from '@futstats/shared';
import Link from 'next/link';
import { MatchRows } from '@/components/MatchRows';
import { SearchBox } from '@/components/SearchBox';
import { seasonLabel } from '@/lib/football';
import { topLeaguePlayers } from '@/lib/leaderboards';
import { topPlayerStat } from '@/lib/worldCupStats';

export const dynamic = 'force-dynamic';

/** Redondea hacia abajo a la centena para un claim veraz ("más de X"). */
function roundedCount(n: number): string {
  const rounded = Math.max(100, Math.floor(n / 100) * 100);
  return rounded.toLocaleString('es-ES');
}

const QUICK_ACTIONS = [
  { href: '/jugadores', title: 'Buscar jugadores', desc: 'Directorio completo con filtros por posición y liga.' },
  { href: '/comparador', title: 'Comparar futbolistas', desc: 'Dos jugadores frente a frente en sus últimos 5 partidos.' },
  { href: '/rankings', title: 'Rankings', desc: 'Goles, asistencias, paradas y más, por liga y temporada.' },
  { href: '/mundial-2026', title: 'Mundial 2026', desc: 'Grupos, eliminatorias y estadísticas del torneo.' },
];

export default async function HomePage() {
  const [playersCount, topScorers, topAssists, topSaves, recentMatches, upcomingMatches, wcScorers] =
    await Promise.all([
      prisma.player.count(),
      topLeaguePlayers('goals', 6),
      topLeaguePlayers('assists', 5),
      topLeaguePlayers('saves', 5),
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
    <div className="space-y-12">
      {/* 1. Hero y buscador */}
      <section className="space-y-5 py-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-pitch-accent">
          Temporadas {seasonLabel(RECENT_SEASON)} y {seasonLabel(CURRENT_SEASON)} · Mundial 2026
        </p>
        <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
          Compara el rendimiento de más de {roundedCount(playersCount)} futbolistas
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-pitch-muted sm:text-base">
          Consulta estadísticas, rankings y resultados de las principales ligas y del Mundial 2026,
          con datos actualizados automáticamente.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/jugadores"
            className="rounded-xl bg-pitch-accent px-6 py-3 text-sm font-semibold text-black hover:opacity-90"
          >
            Buscar jugador
          </Link>
          <Link
            href="/comparador"
            className="rounded-xl border border-pitch-border px-6 py-3 text-sm font-semibold text-white hover:border-pitch-accent"
          >
            Comparar futbolistas
          </Link>
        </div>
        <div className="flex justify-center pt-2">
          <SearchBox />
        </div>
      </section>

      {/* 2. Acciones rápidas */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Acciones rápidas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-xl border border-pitch-border bg-pitch-card p-4 hover:border-pitch-accent"
            >
              <p className="font-semibold">{a.title}</p>
              <p className="mt-1 text-xs text-pitch-muted">{a.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Jugadores destacados */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pitch-muted">En forma — máximos goleadores</h2>
          <Link href="/rankings" className="text-sm text-pitch-accent hover:underline">Ver rankings →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topScorers.map((p, i) => (
            <Link
              key={p.slug}
              href={`/jugadores/${p.slug}`}
              className="flex items-center gap-3 rounded-xl border border-pitch-border bg-pitch-card p-3 hover:border-pitch-accent"
            >
              {p.photoUrl != null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="h-12 w-12 rounded-full bg-pitch-border" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i + 1}. {p.name}</p>
                <p className="truncate text-xs text-pitch-muted">{p.team ?? '—'}</p>
              </div>
              <span className="text-lg font-bold text-pitch-accent">{p.total}</span>
            </Link>
          ))}
          {topScorers.length === 0 && (
            <p className="col-span-3 text-sm text-pitch-muted">Los destacados aparecerán al sincronizar estadísticas.</p>
          )}
        </div>
      </section>

      {/* 4. Rankings principales */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Rankings principales</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {(
            [
              { title: 'Asistencias', rows: topAssists, metric: 'assists' },
              { title: 'Paradas', rows: topSaves, metric: 'saves' },
              { title: 'Goles (Mundial 2026)', rows: wcScorers.map((r) => ({ slug: r.slug, name: r.name, team: r.team, total: r.total })), metric: null },
            ] as const
          ).map((block) => (
            <div key={block.title} className="rounded-xl border border-pitch-border bg-pitch-card">
              <p className="border-b border-pitch-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-pitch-muted">
                {block.title}
              </p>
              <ul className="divide-y divide-pitch-border/50">
                {block.rows.map((r, i) => (
                  <li key={r.slug}>
                    <Link href={`/jugadores/${r.slug}`} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-pitch-border/30">
                      <span className="w-4 text-xs text-pitch-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      <span className="truncate text-xs text-pitch-muted">{r.team ?? ''}</span>
                      <span className="font-semibold text-pitch-accent">{r.total}</span>
                    </Link>
                  </li>
                ))}
                {block.rows.length === 0 && <li className="px-4 py-3 text-xs text-pitch-muted">Sin datos todavía.</li>}
              </ul>
              {block.metric != null && (
                <Link href={`/rankings?metric=${block.metric}`} className="block px-4 py-2 text-xs text-pitch-accent hover:underline">
                  Ver completo →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 5. Partidos recientes y próximos */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Últimos resultados</h2>
          <MatchRows matches={recentMatches} empty="Sin partidos sincronizados todavía." />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Próximos partidos</h2>
          <MatchRows matches={upcomingMatches} empty="Sin partidos programados en la base de datos." />
        </div>
      </section>

      {/* 6. Mundial 2026 */}
      <section>
        <Link
          href="/mundial-2026"
          className="block rounded-2xl border border-pitch-accent/40 bg-pitch-accent/10 p-6 hover:border-pitch-accent"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-pitch-accent">Mundial 2026 · En juego</p>
          <h2 className="mt-1 text-xl font-semibold">Grupos, eliminatorias y estadísticas del torneo</h2>
          <p className="mt-2 text-sm text-pitch-muted">
            48 selecciones con estadísticas individuales y colectivas partido a partido.
            {wcScorers.length > 0 && (
              <> Pichichi actual: <span className="text-white">{wcScorers[0]!.name}</span> con {wcScorers[0]!.total} goles.</>
            )}
          </p>
          <p className="mt-3 text-sm font-medium text-pitch-accent">Abrir sección →</p>
        </Link>
      </section>

      {/* 7. Cobertura y fuente de datos */}
      <section className="rounded-xl border border-pitch-border bg-pitch-card p-5 text-sm text-pitch-muted">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Cobertura</h2>
        <p>
          LaLiga, Premier League, Serie A, Bundesliga y Ligue 1 — temporadas {seasonLabel(RECENT_SEASON)} y{' '}
          {seasonLabel(CURRENT_SEASON)} — más el Mundial 2026 completo. Estadísticas por jugador y partido de
          API-Football, sincronizadas automáticamente cada hora.
        </p>
      </section>
    </div>
  );
}
