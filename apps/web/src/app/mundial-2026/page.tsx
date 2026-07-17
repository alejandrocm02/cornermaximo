import { prisma } from '@futstats/db';
import { CURRENT_SEASON, WORLD_CUP_2026 } from '@futstats/shared';
import Link from 'next/link';
import { MatchRows } from '@/components/MatchRows';
import { seasonLabel } from '@/lib/football';
import { ALL_LEADERBOARD_METRICS, getCompetitionLeaderboard, type LeaderboardRow } from '@/lib/leaderboards';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mundial 2026' };

function LeaderboardTable({ title, rows }: { title: string; rows: LeaderboardRow[] }) {
  return (
    <div className="rounded-lg border border-pitch-border bg-pitch-card">
      <div className="border-b border-pitch-border px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-pitch-muted">{title}</h2>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.slug}-${row.team ?? ''}`} className="border-b border-pitch-border/60 last:border-0">
              <td className="w-10 px-4 py-2 text-pitch-muted">{row.rank}</td>
              <td className="px-2 py-2">
                <Link href={`/jugadores/${row.slug}`} className="font-medium hover:text-pitch-accent">
                  {row.name}
                </Link>
                <p className="text-xs text-pitch-muted">{row.team ?? 'Seleccion'}</p>
              </td>
              <td className="px-4 py-2 text-right text-base font-semibold">{row.total}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-sm text-pitch-muted">Sin datos sincronizados para esta metrica.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function WorldCupPage() {
  const [
    competition,
    playedMatches,
    upcomingMatches,
    goals,
    matchPlayers,
    teams,
    leaderboards,
  ] = await Promise.all([
    prisma.competition.findUnique({
      where: { slug: WORLD_CUP_2026.slug },
      include: {
        seasons: {
          where: { year: CURRENT_SEASON },
          include: {
            standings: {
              include: { team: { select: { name: true, slug: true } } },
              orderBy: [{ position: 'asc' }, { points: 'desc' }],
            },
          },
        },
      },
    }),
    prisma.match.findMany({
      where: { status: 'FINISHED', season: { year: CURRENT_SEASON, competition: { slug: WORLD_CUP_2026.slug } } },
      include: { teams: { include: { team: { select: { name: true, slug: true } } } } },
      orderBy: { kickoffAt: 'desc' },
      take: 10,
    }),
    prisma.match.findMany({
      where: {
        status: 'SCHEDULED',
        kickoffAt: { gte: new Date() },
        season: { year: CURRENT_SEASON, competition: { slug: WORLD_CUP_2026.slug } },
      },
      include: { teams: { include: { team: { select: { name: true, slug: true } } } } },
      orderBy: { kickoffAt: 'asc' },
      take: 10,
    }),
    prisma.matchTeam.aggregate({
      where: { match: { season: { year: CURRENT_SEASON, competition: { slug: WORLD_CUP_2026.slug } } } },
      _sum: { goals: true },
    }),
    prisma.matchPlayer.count({
      where: { match: { season: { year: CURRENT_SEASON, competition: { slug: WORLD_CUP_2026.slug } } } },
    }),
    prisma.seasonTeam.count({
      where: { season: { year: CURRENT_SEASON, competition: { slug: WORLD_CUP_2026.slug } } },
    }),
    Promise.all(
      ALL_LEADERBOARD_METRICS.map(async (metric) => ({
        metric,
        rows: await getCompetitionLeaderboard(WORLD_CUP_2026.slug, CURRENT_SEASON, metric, 6),
      })),
    ),
  ]);

  const season = competition?.seasons[0];
  const standings = season?.standings ?? [];
  const playedCount = playedMatches.length;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-pitch-accent">API-Football league=1, season=2026</p>
          <h1 className="mt-2 text-3xl font-bold">Mundial 2026</h1>
          <p className="mt-2 max-w-2xl text-sm text-pitch-muted">
            Calendario, resultados, clasificacion y estadisticas acumuladas del torneo actual.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
          <div className="rounded-lg border border-pitch-border bg-pitch-card p-4">
            <p className="text-2xl font-semibold">{teams}</p>
            <p className="text-xs text-pitch-muted">selecciones</p>
          </div>
          <div className="rounded-lg border border-pitch-border bg-pitch-card p-4">
            <p className="text-2xl font-semibold">{playedCount}</p>
            <p className="text-xs text-pitch-muted">partidos recientes</p>
          </div>
          <div className="rounded-lg border border-pitch-border bg-pitch-card p-4">
            <p className="text-2xl font-semibold">{goals._sum.goals ?? 0}</p>
            <p className="text-xs text-pitch-muted">goles</p>
          </div>
          <div className="rounded-lg border border-pitch-border bg-pitch-card p-4">
            <p className="text-2xl font-semibold">{matchPlayers}</p>
            <p className="text-xs text-pitch-muted">actuaciones</p>
          </div>
        </div>
      </section>

      {competition == null && (
        <section className="rounded-lg border border-dashed border-pitch-border p-5 text-sm text-pitch-muted">
          El Mundial 2026 esta preparado en codigo. Ejecuta la sincronizacion de la temporada {seasonLabel(CURRENT_SEASON)} para cargar equipos, fixtures y estadisticas.
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Resultados</h2>
          <MatchRows matches={playedMatches} empty="Sin resultados del Mundial sincronizados todavia." />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Proximos partidos</h2>
          <MatchRows matches={upcomingMatches} empty="Sin partidos futuros del Mundial en la base de datos." />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Clasificacion</h2>
        {standings.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-pitch-border">
            <table className="w-full min-w-[560px] bg-pitch-card text-sm">
              <thead className="text-left text-xs uppercase text-pitch-muted">
                <tr className="border-b border-pitch-border">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Seleccion</th>
                  <th className="px-3 py-2 text-right">PJ</th>
                  <th className="px-3 py-2 text-right">G</th>
                  <th className="px-3 py-2 text-right">E</th>
                  <th className="px-3 py-2 text-right">P</th>
                  <th className="px-3 py-2 text-right">GF</th>
                  <th className="px-3 py-2 text-right">GC</th>
                  <th className="px-3 py-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.id} className="border-b border-pitch-border/50 last:border-0">
                    <td className="px-3 py-2 text-pitch-muted">{row.position}</td>
                    <td className="px-3 py-2">
                      <Link href={`/equipos/${row.team.slug}`} className="hover:text-pitch-accent">
                        {row.team.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">{row.played}</td>
                    <td className="px-3 py-2 text-right">{row.won}</td>
                    <td className="px-3 py-2 text-right">{row.drawn}</td>
                    <td className="px-3 py-2 text-right">{row.lost}</td>
                    <td className="px-3 py-2 text-right">{row.goalsFor}</td>
                    <td className="px-3 py-2 text-right">{row.goalsAgainst}</td>
                    <td className="px-3 py-2 text-right font-semibold">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-pitch-muted">Clasificacion aun no sincronizada.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Todas las estadisticas principales</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leaderboards.map(({ metric, rows }) => (
            <LeaderboardTable key={metric.key} title={metric.label} rows={rows} />
          ))}
        </div>
      </section>
    </div>
  );
}
