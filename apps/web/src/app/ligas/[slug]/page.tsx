import { prisma } from '@futstats/db';
import { CURRENT_SEASON, RECENT_SEASON } from '@futstats/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MatchRows } from '@/components/MatchRows';
import { seasonLabel } from '@/lib/football';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const competition = await prisma.competition.findUnique({ where: { slug } });
  return { title: competition?.name ?? 'Liga' };
}

export default async function LeaguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const competition = await prisma.competition.findUnique({
    where: { slug },
    include: {
      seasons: {
        where: { year: { in: [RECENT_SEASON, CURRENT_SEASON] } },
        include: {
          standings: {
            include: { team: { select: { name: true, slug: true, crestUrl: true } } },
            orderBy: { position: 'asc' },
          },
          _count: { select: { teams: true, matches: true } },
        },
        orderBy: { year: 'desc' },
      },
    },
  });
  if (competition == null) notFound();

  const [previousMatches, upcomingMatches, currentFinished] = await Promise.all([
    prisma.match.findMany({
      where: { status: 'FINISHED', season: { competitionId: competition.id, year: RECENT_SEASON } },
      include: { teams: { include: { team: { select: { name: true, slug: true } } } } },
      orderBy: { kickoffAt: 'desc' },
      take: 10,
    }),
    prisma.match.findMany({
      where: {
        status: 'SCHEDULED',
        kickoffAt: { gte: new Date() },
        season: { competitionId: competition.id, year: CURRENT_SEASON },
      },
      include: { teams: { include: { team: { select: { name: true, slug: true } } } } },
      orderBy: { kickoffAt: 'asc' },
      take: 10,
    }),
    prisma.match.findMany({
      where: { status: 'FINISHED', season: { competitionId: competition.id, year: CURRENT_SEASON } },
      include: { teams: { include: { team: { select: { name: true, slug: true } } } } },
      orderBy: { kickoffAt: 'desc' },
      take: 6,
    }),
  ]);

  const currentSeason = competition.seasons.find((season) => season.year === CURRENT_SEASON);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-pitch-accent">
            {seasonLabel(RECENT_SEASON)} y {seasonLabel(CURRENT_SEASON)}
          </p>
          <h1 className="mt-2 text-2xl font-bold">{competition.name}</h1>
          <p className="mt-2 text-sm text-pitch-muted">
            Historico de partidos anteriores y preparacion de la nueva temporada.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {competition.seasons.map((season) => (
            <div key={season.id} className="rounded-lg border border-pitch-border bg-pitch-card px-4 py-3">
              <p className="font-semibold">{seasonLabel(season.year)}</p>
              <p className="text-xs text-pitch-muted">{season._count.matches} partidos</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
          Clasificacion {seasonLabel(CURRENT_SEASON)}
        </h2>
        {currentSeason != null && currentSeason.standings.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-pitch-border">
            <table className="w-full min-w-[560px] bg-pitch-card text-sm">
              <thead className="text-left text-xs uppercase text-pitch-muted">
                <tr className="border-b border-pitch-border">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Equipo</th>
                  <th className="px-3 py-2 text-right">PJ</th>
                  <th className="px-3 py-2 text-right">G</th>
                  <th className="px-3 py-2 text-right">E</th>
                  <th className="px-3 py-2 text-right">P</th>
                  <th className="px-3 py-2 text-right">GF</th>
                  <th className="px-3 py-2 text-right">GC</th>
                  <th className="px-3 py-2 text-right">Pts</th>
                  <th className="px-3 py-2">Forma</th>
                </tr>
              </thead>
              <tbody>
                {currentSeason.standings.map((row) => (
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
                    <td className="px-3 py-2 text-xs tracking-widest text-pitch-muted">{row.form ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-pitch-muted">Clasificacion 2026/27 preparada; aparecera al sincronizar standings.</p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
            Partidos anteriores {seasonLabel(RECENT_SEASON)}
          </h2>
          <MatchRows matches={previousMatches} empty="Sin resultados 2025/26 sincronizados todavia." />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
            Nueva temporada {seasonLabel(CURRENT_SEASON)}
          </h2>
          <MatchRows matches={upcomingMatches.length > 0 ? upcomingMatches : currentFinished} empty="Sin fixtures 2026/27 en la base de datos todavia." />
        </div>
      </section>
    </div>
  );
}
