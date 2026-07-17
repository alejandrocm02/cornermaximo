import { prisma } from '@futstats/db';
import { CURRENT_SEASON, RECENT_SEASON, WORLD_CUP_2026 } from '@futstats/shared';
import Link from 'next/link';
import { MatchRows } from '@/components/MatchRows';
import { SearchBox } from '@/components/SearchBox';
import { seasonLabel } from '@/lib/football';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [leagues, previousMatches, upcomingMatches, worldCup, worldCupStats] = await Promise.all([
    prisma.competition.findMany({ where: { slug: { not: WORLD_CUP_2026.slug } }, orderBy: { name: 'asc' } }),
    prisma.match.findMany({
      where: { status: 'FINISHED', season: { year: RECENT_SEASON } },
      include: {
        teams: { include: { team: { select: { name: true, slug: true } } } },
        season: { include: { competition: { select: { name: true, slug: true } } } },
      },
      orderBy: { kickoffAt: 'desc' },
      take: 6,
    }),
    prisma.match.findMany({
      where: { status: 'SCHEDULED', kickoffAt: { gte: new Date() }, season: { year: CURRENT_SEASON } },
      include: {
        teams: { include: { team: { select: { name: true, slug: true } } } },
        season: { include: { competition: { select: { name: true, slug: true } } } },
      },
      orderBy: { kickoffAt: 'asc' },
      take: 6,
    }),
    prisma.competition.findUnique({
      where: { slug: WORLD_CUP_2026.slug },
      include: { seasons: { where: { year: CURRENT_SEASON } } },
    }),
    prisma.match.aggregate({
      where: { season: { year: CURRENT_SEASON, competition: { slug: WORLD_CUP_2026.slug } } },
      _count: { _all: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 py-4 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-pitch-accent">
            Temporadas {seasonLabel(RECENT_SEASON)} y {seasonLabel(CURRENT_SEASON)}
          </p>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Rendimiento, partidos y rankings listos para el salto a la nueva temporada.
          </h1>
          <p className="max-w-2xl text-sm text-pitch-muted">
            Consulta lo ya jugado en {seasonLabel(RECENT_SEASON)}, prepara {seasonLabel(CURRENT_SEASON)} y sigue el Mundial 2026 desde la misma base de datos.
          </p>
          <SearchBox />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-pitch-border bg-pitch-card p-4">
            <p className="text-2xl font-semibold">{previousMatches.length}</p>
            <p className="text-xs text-pitch-muted">partidos recientes {seasonLabel(RECENT_SEASON)}</p>
          </div>
          <div className="rounded-lg border border-pitch-border bg-pitch-card p-4">
            <p className="text-2xl font-semibold">{upcomingMatches.length}</p>
            <p className="text-xs text-pitch-muted">proximos {seasonLabel(CURRENT_SEASON)}</p>
          </div>
          <Link href="/mundial-2026" className="rounded-lg border border-pitch-accent/50 bg-pitch-accent/10 p-4 hover:border-pitch-accent">
            <p className="text-2xl font-semibold">{worldCupStats._count._all}</p>
            <p className="text-xs text-pitch-muted">partidos Mundial</p>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Link href="/mundial-2026" className="rounded-lg border border-pitch-border bg-pitch-card p-5 hover:border-pitch-accent">
          <p className="text-xs font-semibold uppercase tracking-wide text-pitch-accent">Mundial 2026</p>
          <h2 className="mt-2 text-xl font-semibold">Estadisticas del torneo</h2>
          <p className="mt-2 text-sm text-pitch-muted">
            Clasificacion, calendario, resultados y lideres de goles, asistencias, tiros, duelos, tarjetas y paradas.
          </p>
          <p className="mt-4 text-sm font-medium">{worldCup != null ? 'Abrir seccion' : 'Preparado para sincronizar'}</p>
        </Link>
        <div className="rounded-lg border border-pitch-border bg-pitch-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-pitch-muted">Cobertura</p>
          <h2 className="mt-2 text-xl font-semibold">2025/26 historico y 2026/27 activo</h2>
          <p className="mt-2 text-sm text-pitch-muted">
            La sincronizacion ya puede pedir ambas temporadas. Los partidos finalizados alimentan rankings y perfiles.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Ligas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {leagues.length > 0 ? (
            leagues.map((league) => (
              <Link
                key={league.id}
                href={`/ligas/${league.slug}`}
                className="rounded-lg border border-pitch-border bg-pitch-card p-4 text-center text-sm font-medium hover:border-pitch-accent"
              >
                {league.name}
              </Link>
            ))
          ) : (
            <p className="col-span-5 rounded-lg border border-dashed border-pitch-border p-6 text-center text-sm text-pitch-muted">
              Aun no hay datos. Lanza la primera sincronizacion.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
            Partidos anteriores {seasonLabel(RECENT_SEASON)}
          </h2>
          <MatchRows matches={previousMatches} empty="Sin partidos 2025/26 sincronizados todavia." />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
            Nueva temporada {seasonLabel(CURRENT_SEASON)}
          </h2>
          <MatchRows matches={upcomingMatches} empty="La temporada 2026/27 esta lista; apareceran partidos al sincronizar fixtures." />
        </div>
      </section>
    </div>
  );
}
