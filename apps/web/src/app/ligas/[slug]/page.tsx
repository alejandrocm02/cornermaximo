import { prisma } from '@futstats/db';
import { WORLD_CUP_2026 } from '@futstats/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LeagueInsightsPanel } from '@/components/CompetitionInsightPanels';
import { getLeagueInsights } from '@/lib/competitionInsights';
import { formatMatchDate, seasonLabel } from '@/lib/football';

export const dynamic = 'force-dynamic';

/** Nº de jornadas iniciales que se muestran en la página de la liga. */
const FIRST_ROUNDS_SHOWN = 5;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const competition = await prisma.competition.findUnique({
    where: { slug },
    select: { name: true, type: true },
  });

  return {
    title: competition?.name ?? 'Liga',
    description:
      competition == null
        ? undefined
        : `Clasificación, calendario, equipos y temporadas de ${competition.name} en FutStats.`,
    alternates: { canonical: competition?.type === 'LEAGUE' ? `/ligas/${slug}` : undefined },
  };
}

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ temporada?: string }>;
}) {
  const { slug } = await params;
  const { temporada } = await searchParams;

  const competition = await prisma.competition.findUnique({
    where: { slug },
    include: {
      seasons: {
        orderBy: { year: 'asc' },
        select: { id: true, year: true, isCurrent: true },
      },
    },
  });
  if (competition == null) notFound();

  // Solo el Mundial dispone actualmente de una experiencia específica para
  // copas. Una copa distinta nunca debe redirigir a un torneo que no le
  // corresponde.
  if (competition.type === 'CUP') {
    if (competition.slug === WORLD_CUP_2026.slug) redirect('/mundial-2026');
    notFound();
  }

  const availableSeasons = competition.seasons;
  const requestedYear = temporada != null ? Number(temporada) : undefined;
  const seasonMeta =
    availableSeasons.find((season) => season.year === requestedYear) ??
    availableSeasons.find((season) => season.isCurrent) ??
    availableSeasons[availableSeasons.length - 1];

  // API-Football nombra las jornadas de liga "Regular Season - N".
  const firstRounds = Array.from({ length: FIRST_ROUNDS_SHOWN }, (_, index) => `Regular Season - ${index + 1}`);

  const [season, roundMatches, insights] = await Promise.all([
    seasonMeta != null
      ? prisma.season.findUnique({
          where: { id: seasonMeta.id },
          include: {
            standings: {
              include: { team: { select: { name: true, slug: true, crestUrl: true } } },
              orderBy: { position: 'asc' },
            },
          },
        })
      : null,
    seasonMeta != null
      ? prisma.match.findMany({
          where: { seasonId: seasonMeta.id, round: { in: firstRounds } },
          include: { teams: { include: { team: { select: { name: true, slug: true } } } } },
          orderBy: { kickoffAt: 'asc' },
        })
      : [],
    seasonMeta != null ? getLeagueInsights(seasonMeta.id) : null,
  ]);

  const jornadas = firstRounds
    .map((round, index) => ({
      num: index + 1,
      matches: roundMatches.filter((match) => match.round === round),
    }))
    .filter((jornada) => jornada.matches.length > 0);

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ label: 'Ligas', href: '/ligas' }, { label: competition.name }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="fs-eyebrow">{competition.countryId != null ? 'Competición de liga' : 'Liga'}</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            {competition.name}
            {season != null && (
              <span className="text-pitch-muted"> · {seasonLabel(season.year, competition.seasonFormat)}</span>
            )}
          </h1>
        </div>

        {availableSeasons.length > 1 && (
          <nav aria-label="Temporadas disponibles" className="flex flex-wrap gap-2 text-sm">
            {availableSeasons.map((availableSeason) => (
              <Link
                key={availableSeason.id}
                href={`/ligas/${slug}?temporada=${availableSeason.year}`}
                aria-current={availableSeason.id === seasonMeta?.id ? 'page' : undefined}
                className={`rounded-lg border px-3 py-1.5 ${
                  availableSeason.id === seasonMeta?.id
                    ? 'border-pitch-accent bg-pitch-accent/10 text-pitch-accent'
                    : 'border-pitch-border text-pitch-muted hover:border-pitch-border-strong hover:text-white'
                }`}
              >
                {seasonLabel(availableSeason.year, competition.seasonFormat)}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {insights != null && <LeagueInsightsPanel insights={insights} />}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Clasificación</h2>
        {season != null && season.standings.length > 0 && (
          <p className="-mt-2 mb-3 text-xs text-pitch-muted">
            Última actualización:{' '}
            {new Date(Math.max(...season.standings.map((row) => row.updatedAt.getTime()))).toLocaleString('es-ES', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        )}
        {season != null && season.standings.length > 0 && (
          <p className="mb-1 text-xs text-pitch-muted sm:hidden" aria-hidden="true">
            Desliza la tabla lateralmente para ver todas las columnas →
          </p>
        )}

        {season != null && season.standings.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-pitch-border">
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
                {season.standings.map((row) => (
                  <tr key={row.id} className="border-b border-pitch-border/50 last:border-0">
                    <td className="px-3 py-2 text-pitch-muted">{row.position}</td>
                    <td className="px-3 py-2">
                      <Link href={`/equipos/${row.team.slug}`} className="inline-flex items-center gap-2 hover:text-pitch-accent">
                        {row.team.crestUrl != null && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img width={22} height={22} src={row.team.crestUrl} alt="" className="h-[22px] w-[22px] object-contain" />
                        )}
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
          <p className="text-sm text-pitch-muted">
            La clasificación de esta temporada todavía no está disponible. Los datos se incorporarán
            automáticamente cuando la fuente los publique.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
          Primeras {FIRST_ROUNDS_SHOWN} jornadas
        </h2>
        {jornadas.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {jornadas.map((jornada) => (
              <div key={jornada.num} className="fs-panel">
                <p className="border-b border-pitch-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-pitch-muted">
                  Jornada {jornada.num}
                </p>
                <ul className="divide-y divide-pitch-border/50">
                  {jornada.matches.map((match) => {
                    const home = match.teams.find((team) => team.isHome);
                    const away = match.teams.find((team) => !team.isHome);
                    const played = match.status === 'FINISHED';
                    return (
                      <li key={match.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-right">
                          {home != null ? (
                            <Link href={`/equipos/${home.team.slug}`} className="hover:text-pitch-accent">
                              {home.team.name}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </span>
                        <span
                          className={`w-14 shrink-0 rounded px-1 text-center font-semibold ${
                            played ? 'bg-pitch-accent/10 text-pitch-accent' : 'text-pitch-muted'
                          }`}
                          title={played ? 'Finalizado' : formatMatchDate(match.kickoffAt)}
                        >
                          {played
                            ? `${home?.goals ?? '-'}–${away?.goals ?? '-'}`
                            : formatMatchDate(match.kickoffAt).slice(0, 6)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {away != null ? (
                            <Link href={`/equipos/${away.team.slug}`} className="hover:text-pitch-accent">
                              {away.team.name}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-pitch-muted">
            El calendario de esta temporada todavía no está disponible. Se incorporará automáticamente cuando la fuente lo publique.
          </p>
        )}
      </section>
    </div>
  );
}
