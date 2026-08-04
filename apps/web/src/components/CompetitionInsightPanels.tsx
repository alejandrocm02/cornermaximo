import Link from 'next/link';
import { MatchRows } from '@/components/MatchRows';
import { SectionHeader } from '@/components/SectionHeader';
import { formatMatchDate, roundLabel } from '@/lib/football';
import type {
  FormResult,
  InsightMatch,
  LeagueInsights,
  PlayerLeader,
  SplitPerformance,
  TeamInsights,
} from '@/lib/competitionInsights';

const FORM_LABEL: Record<FormResult, string> = { W: 'V', D: 'E', L: 'D' };
const FORM_CLASS: Record<FormResult, string> = {
  W: 'border-pitch-accent/40 bg-pitch-accent/10 text-pitch-accent',
  D: 'border-pitch-warning/40 bg-pitch-warning/10 text-pitch-warning',
  L: 'border-pitch-danger/40 bg-pitch-danger/10 text-pitch-danger',
};

function hydratedMatches(matches: InsightMatch[]) {
  return matches.map((match) => ({
    ...match,
    kickoffAt: new Date(match.kickoffAt),
  }));
}

function NextMatchCard({ match }: { match: InsightMatch | null }) {
  if (match == null) {
    return (
      <div className="fs-panel grid min-h-44 place-items-center p-5 text-center">
        <div>
          <p className="fs-eyebrow justify-center">Agenda</p>
          <p className="mt-3 text-sm text-pitch-muted">No hay un próximo partido programado.</p>
        </div>
      </div>
    );
  }

  const home = match.teams.find((entry) => entry.isHome);
  const away = match.teams.find((entry) => !entry.isHome);

  return (
    <Link
      href={`/partidos/${match.id}`}
      className="fs-panel-interactive group block min-h-44 overflow-hidden p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="fs-eyebrow">Próximo partido</p>
        <span className="text-2xs text-pitch-muted transition-colors group-hover:text-pitch-accent">
          Ver previa →
        </span>
      </div>
      <p className="mt-3 text-xs text-pitch-muted">
        {formatMatchDate(new Date(match.kickoffAt))}
        {roundLabel(match.round) != null && ` · ${roundLabel(match.round)}`}
      </p>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-center">
        <TeamIdentity entry={home} />
        <span className="font-display text-sm font-bold text-pitch-muted">VS</span>
        <TeamIdentity entry={away} />
      </div>
    </Link>
  );
}

function TeamIdentity({ entry }: { entry: InsightMatch['teams'][number] | undefined }) {
  return (
    <span className="min-w-0">
      {entry?.team.crestUrl != null ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          width={40}
          height={40}
          src={entry.team.crestUrl}
          alt=""
          className="mx-auto h-10 w-10 object-contain"
        />
      ) : (
        <span aria-hidden="true" className="mx-auto block h-10 w-10 rounded-full bg-pitch-elevated" />
      )}
      <span className="mt-2 block truncate text-sm font-semibold text-white">
        {entry?.team.name ?? 'Por confirmar'}
      </span>
    </span>
  );
}

function FormAndSplit({ form, home, away }: { form: FormResult[]; home: SplitPerformance; away: SplitPerformance }) {
  return (
    <div className="fs-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="fs-eyebrow">Forma reciente</p>
          <div className="mt-3 flex gap-2" aria-label="Resultados de los últimos partidos, del más antiguo al más reciente">
            {form.length > 0 ? (
              form.map((result, index) => (
                <span
                  key={`${result}-${index}`}
                  title={result === 'W' ? 'Victoria' : result === 'D' ? 'Empate' : 'Derrota'}
                  className={`grid h-8 w-8 place-items-center rounded-full border font-display text-xs font-bold ${FORM_CLASS[result]}`}
                >
                  {FORM_LABEL[result]}
                </span>
              ))
            ) : (
              <span className="text-sm text-pitch-muted">Sin resultados disponibles.</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xs uppercase tracking-wide text-pitch-muted">Balance total</p>
          <p className="mt-1 font-display text-xl font-bold text-white">
            {home.points + away.points} pts
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <SplitCard label="Como local" performance={home} />
        <SplitCard label="Como visitante" performance={away} />
      </div>
    </div>
  );
}

function SplitCard({ label, performance }: { label: string; performance: SplitPerformance }) {
  return (
    <div className="rounded-xl border border-pitch-border bg-pitch-elevated/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-pitch-muted">{label}</p>
        <span className="font-display text-sm font-bold text-pitch-accent">
          {performance.pointsPerGame == null ? '—' : performance.pointsPerGame.toLocaleString('es-ES')} pts/PJ
        </span>
      </div>
      <p className="mt-3 text-sm text-pitch-subtle">
        <span className="font-semibold text-white">{performance.played} PJ</span>
        {' · '}{performance.won}V {performance.drawn}E {performance.lost}D
      </p>
      <p className="mt-1 text-xs text-pitch-muted">
        {performance.goalsFor} GF · {performance.goalsAgainst} GC · {performance.points} puntos
      </p>
    </div>
  );
}

function LeaderCard({
  title,
  metric,
  players,
  showTeam,
}: {
  title: string;
  metric: 'goals' | 'assists';
  players: PlayerLeader[];
  showTeam: boolean;
}) {
  return (
    <div className="fs-panel overflow-hidden">
      <p className="border-b border-pitch-border/60 bg-pitch-elevated/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-pitch-muted">
        {title}
      </p>
      {players.length > 0 ? (
        <ol className="divide-y divide-pitch-border/50">
          {players.map((player, index) => (
            <li key={player.slug}>
              <Link
                href={`/jugadores/${player.slug}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-pitch-elevated/40"
              >
                <span className="w-4 shrink-0 font-display text-xs font-bold text-pitch-muted">{index + 1}</span>
                {player.photoUrl != null ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    width={36}
                    height={36}
                    src={player.photoUrl}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-pitch-border"
                  />
                ) : (
                  <span aria-hidden="true" className="h-9 w-9 shrink-0 rounded-full bg-pitch-elevated ring-1 ring-pitch-border" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{player.name}</span>
                  <span className="block truncate text-2xs text-pitch-muted">
                    {showTeam && player.teamName != null ? `${player.teamName} · ` : ''}
                    {player.appearances} PJ · {player.minutes}&apos;
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-xl font-bold text-pitch-accent">
                    {player[metric]}
                  </span>
                  <span className="block text-2xs uppercase text-pitch-muted">
                    {metric === 'goals' ? 'goles' : 'asist.'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 py-8 text-center text-sm text-pitch-muted">Sin estadísticas disponibles.</p>
      )}
    </div>
  );
}

export function TeamInsightsPanel({ insights }: { insights: TeamInsights }) {
  return (
    <section className="space-y-8" aria-label="Rendimiento del equipo">
      <div className="grid gap-4 lg:grid-cols-2">
        <NextMatchCard match={insights.nextMatch} />
        <FormAndSplit form={insights.form} home={insights.home} away={insights.away} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div>
          <SectionHeader eyebrow="Últimos cinco" title="Resultados recientes" />
          <MatchRows
            matches={hydratedMatches(insights.recentMatches)}
            empty="Todavía no hay resultados finalizados para esta temporada."
          />
        </div>
        <div>
          <SectionHeader eyebrow="Temporada" title="Líderes del equipo" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <LeaderCard title="Goleadores" metric="goals" players={insights.scorers} showTeam={false} />
            <LeaderCard title="Asistentes" metric="assists" players={insights.assisters} showTeam={false} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function LeagueInsightsPanel({ insights }: { insights: LeagueInsights }) {
  return (
    <section className="space-y-8" aria-label="Análisis de la competición">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Agenda" title="Siguiente partido" />
          <NextMatchCard match={insights.nextMatch} />
        </div>
        <div>
          <SectionHeader eyebrow="Últimos resultados" title="Actividad reciente" />
          <MatchRows
            matches={hydratedMatches(insights.recentMatches)}
            empty="Todavía no hay partidos finalizados en esta temporada."
          />
        </div>
      </div>

      <div>
        <SectionHeader eyebrow="Rendimiento individual" title="Líderes de la competición" />
        <div className="grid gap-4 lg:grid-cols-2">
          <LeaderCard title="Máximos goleadores" metric="goals" players={insights.scorers} showTeam />
          <LeaderCard title="Máximos asistentes" metric="assists" players={insights.assisters} showTeam />
        </div>
      </div>

      <div>
        <SectionHeader eyebrow="Comparativa" title="Rendimiento como local y visitante" />
        {insights.splitTable.length > 0 ? (
          <>
            <p className="mb-2 text-xs text-pitch-muted sm:hidden" aria-hidden="true">
              Desliza lateralmente para ver todos los datos →
            </p>
            <div className="overflow-x-auto rounded-xl border border-pitch-border">
              <table className="w-full min-w-[760px] bg-pitch-card text-sm">
                <thead className="border-b border-pitch-border bg-pitch-elevated/40 text-left text-2xs uppercase tracking-wide text-pitch-muted">
                  <tr>
                    <th className="px-3 py-3">Equipo</th>
                    <th className="px-3 py-3 text-right">Local PJ</th>
                    <th className="px-3 py-3 text-right">Local Pts</th>
                    <th className="px-3 py-3 text-right">Local GF-GC</th>
                    <th className="px-3 py-3 text-right">Visit. PJ</th>
                    <th className="px-3 py-3 text-right">Visit. Pts</th>
                    <th className="px-3 py-3 text-right">Visit. GF-GC</th>
                    <th className="px-3 py-3 text-right">Mejor registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pitch-border/50">
                  {insights.splitTable.map((row) => {
                    const homePpg = row.home.pointsPerGame ?? 0;
                    const awayPpg = row.away.pointsPerGame ?? 0;
                    const best = homePpg === awayPpg ? 'Equilibrado' : homePpg > awayPpg ? 'Local' : 'Visitante';
                    return (
                      <tr key={row.team.id} className="transition-colors hover:bg-pitch-elevated/35">
                        <td className="px-3 py-3">
                          <Link href={`/equipos/${row.team.slug}`} className="flex items-center gap-2 font-semibold text-white hover:text-pitch-accent">
                            {row.team.crestUrl != null && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img width={24} height={24} src={row.team.crestUrl} alt="" className="h-6 w-6 object-contain" />
                            )}
                            {row.team.name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{row.home.played}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{row.home.points}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-pitch-muted">{row.home.goalsFor}-{row.home.goalsAgainst}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{row.away.played}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{row.away.points}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-pitch-muted">{row.away.goalsFor}-{row.away.goalsAgainst}</td>
                        <td className="px-3 py-3 text-right">
                          <span className="fs-chip">{best}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="fs-panel px-4 py-8 text-center text-sm text-pitch-muted">
            El desglose aparecerá cuando existan partidos finalizados con marcador.
          </p>
        )}
      </div>
    </section>
  );
}
