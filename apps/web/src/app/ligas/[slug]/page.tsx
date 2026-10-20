import { prisma } from '@cornermaximo/db';
import { WORLD_CUP_2026 } from '@cornermaximo/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LeagueInsightsPanel } from '@/components/CompetitionInsightPanels';
import { getLeagueInsights } from '@/lib/competitionInsights';
import { isUefaClubCompetition } from '@/lib/competitionLinks';
import { DISPLAY_TIME_ZONE, formatMatchDate, seasonLabel } from '@/lib/football';
import { UefaCompetitionView } from './UefaCompetitionView';

export const dynamic = 'force-dynamic';

/** Nº de jornadas iniciales que se muestran en la página de la liga. */
const FIRST_ROUNDS_SHOWN = 5;

function formatGoalDifference(diff: number): string {
  return diff > 0 ? `+${diff}` : String(diff);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const competition = await prisma.competition.findUnique({
    where: { slug },
    select: { name: true, type: true },
  });

  const isUefa = competition != null && isUefaClubCompetition(slug);
  return {
    title: competition?.name ?? 'Liga',
    description:
      competition == null
        ? undefined
        : isUefa
          ? `${competition.name}: clasificación de la fase de liga, partidos, eliminatorias, goleadores y asistentes en CornerMaximo.`
          : `Clasificación, calendario, equipos y temporadas de ${competition.name} en CornerMaximo.`,
    alternates: { canonical: competition?.type === 'LEAGUE' || isUefa ? `/ligas/${slug}` : undefined },
  };
}

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ temporada?: string; ronda?: string }>;
}) {
  const { slug } = await params;
  const { temporada, ronda } = await searchParams;

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

  // Copas con página propia: el Mundial tiene su sección y las competiciones
  // UEFA de clubes una vista de fase de liga y eliminatorias. Cualquier otra
  // copa no debe mostrarse con la plantilla de liga.
  if (competition.type === 'CUP') {
    if (competition.slug === WORLD_CUP_2026.slug) redirect('/mundial-2026');
    if (!isUefaClubCompetition(competition.slug)) notFound();
    const currentSeason = competition.seasons.find((season) => season.isCurrent) ?? competition.seasons.at(-1) ?? null;
    return (
      <UefaCompetitionView
        competition={{ name: competition.name, slug: competition.slug, seasonFormat: competition.seasonFormat }}
        season={currentSeason == null ? null : { id: currentSeason.id, year: currentSeason.year }}
        requestedRound={typeof ronda === 'string' ? ronda.slice(0, 80) : undefined}
      />
    );
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

      {/* La clasificación es lo que más se consulta de una liga: va primero. */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Clasificación</h2>
        {season != null && season.standings.length > 0 && (
          <p className="-mt-2 mb-3 text-xs text-pitch-muted">
            Última actualización:{' '}
            {new Date(Math.max(...season.standings.map((row) => row.updatedAt.getTime()))).toLocaleString('es-ES', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: DISPLAY_TIME_ZONE,
            })}
          </p>
        )}
        {season != null && season.standings.length > 0 ? (
          // En móvil se ocultan G, E, P, GF, GC y forma, y se muestra la diferencia
          // de goles: la tabla cabe sin desplazarse y los puntos quedan a la vista.
          <div className="overflow-x-auto rounded-xl border border-pitch-border">
            <table className="w-full bg-pitch-card text-sm sm:min-w-[560px]">
              <caption className="sr-only">Clasificación de {competition.name}</caption>
              <thead className="text-left text-xs uppercase text-pitch-muted">
                <tr className="border-b border-pitch-border">
                  <th scope="col" className="px-3 py-2">#</th>
                  <th scope="col" className="px-3 py-2">Equipo</th>
                  <th scope="col" className="px-3 py-2 text-right">PJ</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">G</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">E</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">P</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">GF</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">GC</th>
                  <th scope="col" className="px-3 py-2 text-right sm:hidden">DG</th>
                  <th scope="col" className="px-3 py-2 text-right">Pts</th>
                  <th scope="col" className="hidden px-3 py-2 sm:table-cell">Forma</th>
                </tr>
              </thead>
              <tbody>
                {season.standings.map((row) => (
                  <tr key={row.id} className="border-b border-pitch-border/50 last:border-0">
                    <td className="px-3 py-2 text-pitch-muted">{row.position}</td>
                    <td className="w-full max-w-0 px-3 py-2 sm:w-auto sm:max-w-none">
                      <Link href={`/equipos/${row.team.slug}`} className="flex min-w-0 items-center gap-2 hover:text-pitch-accent">
                        {row.team.crestUrl != null && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img width={22} height={22} src={row.team.crestUrl} alt="" className="h-[22px] w-[22px] shrink-0 object-contain" />
                        )}
                        <span className="truncate">{row.team.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.played}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{row.won}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{row.drawn}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{row.lost}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{row.goalsFor}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{row.goalsAgainst}</td>
                    <td className="px-3 py-2 text-right tabular-nums sm:hidden">{formatGoalDifference(row.goalsFor - row.goalsAgainst)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.points}</td>
                    <td className="hidden px-3 py-2 text-xs tracking-widest text-pitch-muted sm:table-cell">{row.form ?? ''}</td>
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

      {insights != null && <LeagueInsightsPanel insights={insights} />}

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
