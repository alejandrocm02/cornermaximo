import Image from 'next/image';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { DISPLAY_TIME_ZONE, formatMatchDate, roundLabel, seasonLabel } from '@/lib/football';
import { rankingRows, type RankingRow } from '@/lib/leaderboards';
import {
  getUefaCompetitionSeason,
  groupMatchesByRound,
  LEAGUE_PHASE_ZONES,
  leaguePhaseZone,
  selectRound,
  type LeaguePhaseZone,
  type UefaMatch,
} from '@/lib/uefaCompetition';

const ZONE_STYLE: Record<LeaguePhaseZone, { bar: string; dot: string }> = {
  ROUND_OF_16: { bar: 'border-l-pitch-accent', dot: 'bg-pitch-accent' },
  PLAYOFF: { bar: 'border-l-pitch-warning', dot: 'bg-pitch-warning' },
  ELIMINATED: { bar: 'border-l-transparent', dot: 'bg-pitch-border' },
};

interface Props {
  competition: { name: string; slug: string; seasonFormat: 'SPLIT_YEAR' | 'CALENDAR_YEAR' };
  season: { id: number; year: number } | null;
  requestedRound: string | undefined;
}

export async function UefaCompetitionView({ competition, season, requestedRound }: Props) {
  const [data, scorers, assisters] = season == null
    ? [null, null, null]
    : await Promise.all([
        getUefaCompetitionSeason(season.id),
        rankingRows({ metric: 'goals', league: competition.slug, season: season.year, limit: 10 }).catch(() => null),
        rankingRows({ metric: 'assists', league: competition.slug, season: season.year, limit: 10 }).catch(() => null),
      ]);

  const rounds = data == null ? [] : groupMatchesByRound(data.matches);
  const current = selectRound(rounds, requestedRound);
  const standings = data?.standings ?? [];
  const lastStandingsUpdate = standings.length > 0 ? new Date(Math.max(...standings.map((row) => row.updatedAt.getTime()))) : null;

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ label: 'Ligas', href: '/ligas' }, { label: competition.name }]} />

      <header>
        <p className="fs-eyebrow">Competición europea de clubes</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          {competition.name}
          {season != null && <span className="text-pitch-muted"> · {seasonLabel(season.year, competition.seasonFormat)}</span>}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-pitch-muted">
          Fase de liga de 36 equipos y eliminatorias. Las rondas previas no se incluyen.
        </p>
      </header>

      <section aria-labelledby="fase-liga">
        <h2 id="fase-liga" className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Fase de liga</h2>
        {lastStandingsUpdate != null && (
          <p className="-mt-2 mb-3 text-xs text-pitch-muted">
            Última actualización:{' '}
            {lastStandingsUpdate.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: DISPLAY_TIME_ZONE })}
          </p>
        )}
        {standings.length > 0 ? (
          <>
            <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-pitch-muted" aria-label="Leyenda de la clasificación">
              {(Object.keys(LEAGUE_PHASE_ZONES) as LeaguePhaseZone[]).map((zone) => (
                <li key={zone} className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${ZONE_STYLE[zone].dot}`} />
                  {LEAGUE_PHASE_ZONES[zone].from}–{LEAGUE_PHASE_ZONES[zone].to}: {LEAGUE_PHASE_ZONES[zone].label}
                </li>
              ))}
            </ul>
            <p className="mb-1 text-xs text-pitch-muted sm:hidden" aria-hidden="true">
              Desliza la tabla lateralmente para ver todas las columnas →
            </p>
            <div className="overflow-x-auto rounded-xl border border-pitch-border">
              <table className="w-full min-w-[560px] bg-pitch-card text-sm">
                <caption className="sr-only">Clasificación de la fase de liga de {competition.name}</caption>
                <thead className="text-left text-xs uppercase text-pitch-muted">
                  <tr className="border-b border-pitch-border">
                    <th scope="col" className="px-3 py-2">#</th>
                    <th scope="col" className="px-3 py-2">Equipo</th>
                    <th scope="col" className="px-3 py-2 text-right">PJ</th>
                    <th scope="col" className="px-3 py-2 text-right">G</th>
                    <th scope="col" className="px-3 py-2 text-right">E</th>
                    <th scope="col" className="px-3 py-2 text-right">P</th>
                    <th scope="col" className="px-3 py-2 text-right">DG</th>
                    <th scope="col" className="px-3 py-2 text-right">Pts</th>
                    <th scope="col" className="px-3 py-2">Forma</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row) => {
                    const zone = leaguePhaseZone(row.position);
                    const diff = row.goalsFor - row.goalsAgainst;
                    return (
                      <tr key={row.id} className="border-b border-pitch-border/50 last:border-0">
                        <td className={`border-l-4 px-3 py-2 text-pitch-muted ${ZONE_STYLE[zone].bar}`}>
                          {row.position}
                          <span className="sr-only">, {LEAGUE_PHASE_ZONES[zone].label}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Link href={`/equipos/${row.team.slug}`} className="inline-flex items-center gap-2 hover:text-pitch-accent">
                            {row.team.crestUrl != null && (
                              <Image width={22} height={22} src={row.team.crestUrl} alt="" className="h-[22px] w-[22px] object-contain" />
                            )}
                            {row.team.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right">{row.played}</td>
                        <td className="px-3 py-2 text-right">{row.won}</td>
                        <td className="px-3 py-2 text-right">{row.drawn}</td>
                        <td className="px-3 py-2 text-right">{row.lost}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{diff > 0 ? `+${diff}` : diff}</td>
                        <td className="px-3 py-2 text-right font-semibold">{row.points}</td>
                        <td className="px-3 py-2 text-xs tracking-widest text-pitch-muted">{row.form ?? ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-pitch-muted">
            La clasificación todavía no está disponible. Se incorporará automáticamente cuando la fuente la publique.
          </p>
        )}
      </section>

      <section aria-labelledby="partidos-ronda">
        <h2 id="partidos-ronda" className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Partidos</h2>
        {rounds.length > 0 && current != null ? (
          <>
            <nav aria-label="Rondas" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 text-sm">
              {rounds.map((round) => {
                const active = round.round === current.round;
                return (
                  <Link
                    key={round.round}
                    href={`/ligas/${competition.slug}?ronda=${encodeURIComponent(round.round)}#partidos-ronda`}
                    aria-current={active ? 'page' : undefined}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 ${
                      active
                        ? 'border-pitch-accent bg-pitch-accent/10 text-pitch-accent'
                        : 'border-pitch-border text-pitch-muted hover:border-pitch-border-strong hover:text-white'
                    }`}
                  >
                    {shortRoundLabel(round.round)}
                  </Link>
                );
              })}
            </nav>
            <div className="fs-panel">
              <p className="border-b border-pitch-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-pitch-muted">
                {roundLabel(current.round) ?? current.round}
              </p>
              <ul className="divide-y divide-pitch-border/50">
                {current.matches.map((match) => <MatchRow key={match.id} match={match} />)}
              </ul>
            </div>
          </>
        ) : (
          <p className="text-sm text-pitch-muted">
            El calendario todavía no está sincronizado. Aparecerá en cuanto la fuente publique los partidos.
          </p>
        )}
      </section>

      <section aria-labelledby="lideres" className="grid gap-6 lg:grid-cols-2">
        <h2 id="lideres" className="sr-only">Máximos goleadores y asistentes</h2>
        <LeaderList title="Goleadores" unit="goles" rows={scorers} />
        <LeaderList title="Asistentes" unit="asistencias" rows={assisters} />
      </section>
    </div>
  );
}

/** "League Stage - 3" -> "J3"; el resto, con su nombre en español. */
function shortRoundLabel(round: string): string {
  const leagueRound = round.match(/^League (?:Stage|Phase) - (\d+)$/);
  if (leagueRound != null) return `J${leagueRound[1]}`;
  return roundLabel(round) ?? round;
}

function MatchRow({ match }: { match: UefaMatch }) {
  const home = match.teams.find((team) => team.isHome);
  const away = match.teams.find((team) => !team.isHome);
  const played = match.status === 'FINISHED' || match.status === 'LIVE';
  const penalties = home?.penaltyGoals != null && away?.penaltyGoals != null ? ` (${home.penaltyGoals}–${away.penaltyGoals} pen.)` : '';
  return (
    <li>
      <Link href={`/partidos/${match.id}`} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-pitch-elevated/60">
        <TeamName team={home?.team} align="right" />
        <span
          className={`w-20 shrink-0 rounded px-1 text-center font-semibold tabular-nums ${
            played ? 'bg-pitch-accent/10 text-pitch-accent' : 'text-xs text-pitch-muted'
          }`}
        >
          {played ? `${home?.goals ?? '-'}–${away?.goals ?? '-'}` : formatMatchDate(match.kickoffAt)}
          {match.status === 'LIVE' && <span className="block text-[10px] font-normal uppercase">En juego</span>}
        </span>
        <TeamName team={away?.team} align="left" />
      </Link>
      {penalties !== '' && <p className="-mt-1 pb-2 text-center text-xs text-pitch-muted">{penalties.trim()}</p>}
    </li>
  );
}

function TeamName({ team, align }: { team: UefaMatch['teams'][number]['team'] | undefined; align: 'left' | 'right' }) {
  if (team == null) return <span className="min-w-0 flex-1">—</span>;
  return (
    <span className={`flex min-w-0 flex-1 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      {team.crestUrl != null && (
        <Image width={20} height={20} src={team.crestUrl} alt="" className="h-5 w-5 shrink-0 object-contain" />
      )}
      <span className="truncate">{team.name}</span>
    </span>
  );
}

function LeaderList({ title, unit, rows }: { title: string; unit: string; rows: RankingRow[] | null }) {
  return (
    <div className="fs-panel">
      <h3 className="border-b border-pitch-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-pitch-muted">{title}</h3>
      {rows == null || rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-pitch-muted">Sin datos todavía.</p>
      ) : (
        <ol className="divide-y divide-pitch-border/50">
          {rows.filter((row) => row.total > 0).map((row, index) => (
            <li key={row.slug} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-5 text-right text-pitch-muted tabular-nums">{index + 1}</span>
              <Link href={`/jugadores/${row.slug}`} className="min-w-0 flex-1 hover:text-pitch-accent">
                <span className="block truncate font-medium">{row.name}</span>
                {row.team != null && <span className="block truncate text-xs text-pitch-muted">{row.team}</span>}
              </Link>
              <span className="font-semibold tabular-nums">
                {row.total}
                <span className="sr-only"> {unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
