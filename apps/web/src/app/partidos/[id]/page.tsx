import type { MatchStatus } from '@futstats/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { roundLabel, statusLabel } from '@/lib/football';
import { getMatchDetail, type MatchDetail, type MatchDetailPlayer, type MatchListTeam } from '@/lib/matches';

export const dynamic = 'force-dynamic';

const EVENT_LABEL: Record<string, string> = {
  GOAL: 'Gol',
  OWN_GOAL: 'Gol en propia puerta',
  PENALTY_GOAL: 'Gol de penalti',
  MISSED_PENALTY: 'Penalti fallado',
  YELLOW_CARD: 'Tarjeta amarilla',
  SECOND_YELLOW: 'Segunda amarilla',
  RED_CARD: 'Tarjeta roja',
  SUBSTITUTION: 'Sustitución',
  VAR: 'VAR',
};

const ROLE_LABEL: Record<string, string> = {
  STARTER: 'Titular',
  SUBSTITUTE: 'Suplente',
  BENCH_UNUSED: 'Banquillo',
  NOT_CALLED: 'No convocado',
};

function parseMatchId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = parseMatchId(rawId);
  if (id == null) return { title: 'Partido' };
  const match = await getMatchDetail(id);
  if (match == null) return { title: 'Partido' };
  const title = `${match.home?.name ?? 'Local'} vs ${match.away?.name ?? 'Visitante'}`;
  return {
    title,
    description: `${title}: resultado, alineaciones, eventos y estadísticas del partido en ${match.competition.name}.`,
    alternates: { canonical: `/partidos/${id}` },
  };
}

function competitionHref(match: MatchDetail): string | null {
  if (match.competition.type === 'LEAGUE') return `/ligas/${match.competition.slug}`;
  if (match.competition.slug === 'mundial-2026') return '/mundial-2026';
  return null;
}

function TeamIdentity({ team, align }: { team: MatchListTeam | null; align: 'left' | 'right' }) {
  const content = (
    <>
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white p-2 shadow-lg sm:h-20 sm:w-20">
        {team?.crestUrl != null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.crestUrl} alt="" width={64} height={64} className="h-full w-full object-contain" />
        ) : (
          <span aria-hidden="true" className="h-8 w-8 rounded-full bg-pitch-border" />
        )}
      </span>
      <span className={`mt-3 font-display text-base font-semibold text-white sm:text-xl ${align === 'right' ? 'text-right' : ''}`}>
        {team?.name ?? (align === 'left' ? 'Local' : 'Visitante')}
      </span>
    </>
  );

  return team == null ? (
    <div className={`flex min-w-0 flex-col ${align === 'right' ? 'items-end' : 'items-start'}`}>{content}</div>
  ) : (
    <Link href={`/equipos/${team.slug}`} className={`flex min-w-0 flex-col ${align === 'right' ? 'items-end' : 'items-start'} hover:opacity-90`}>
      {content}
    </Link>
  );
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseMatchId(rawId);
  if (id == null) notFound();
  const match = await getMatchDetail(id);
  if (match == null) notFound();

  const kickoff = new Date(match.kickoffAt);
  const finished = match.status === 'FINISHED';
  const live = match.status === 'LIVE';
  const competitionUrl = competitionHref(match);
  const homePlayers = match.players.filter((player) => player.teamId === match.home?.id);
  const awayPlayers = match.players.filter((player) => player.teamId === match.away?.id);
  const hasPlayerStats = match.players.some(
    (player) => player.minutesPlayed > 0 || player.fieldStats != null || player.goalkeeperStats != null,
  );
  const translatedRound = roundLabel(match.round);
  const eventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${match.home?.name ?? 'Local'} vs ${match.away?.name ?? 'Visitante'}`,
    startDate: match.kickoffAt,
    eventStatus: live ? 'https://schema.org/EventInProgress' : finished ? 'https://schema.org/EventCompleted' : 'https://schema.org/EventScheduled',
    homeTeam: match.home != null ? { '@type': 'SportsTeam', name: match.home.name } : undefined,
    awayTeam: match.away != null ? { '@type': 'SportsTeam', name: match.away.name } : undefined,
  };

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }} />
      <Breadcrumbs items={[{ label: 'Partidos', href: '/partidos' }, { label: `${match.home?.name ?? 'Local'} vs ${match.away?.name ?? 'Visitante'}` }]} />

      <header className="fs-panel relative overflow-hidden p-5 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(48,229,157,0.1),transparent_48%)]" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-center gap-2 text-center text-xs text-pitch-muted">
            {competitionUrl != null ? (
              <Link href={competitionUrl} className="font-semibold text-pitch-accent hover:underline">{match.competition.name}</Link>
            ) : (
              <span className="font-semibold text-pitch-subtle">{match.competition.name}</span>
            )}
            {translatedRound != null && <><span aria-hidden="true">·</span><span>{translatedRound}</span></>}
            <span aria-hidden="true">·</span>
            <span className={live ? 'font-semibold text-pitch-danger' : ''}>{statusLabel(match.status as MatchStatus)}</span>
          </div>

          <div className="mx-auto mt-6 grid max-w-3xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 sm:gap-8">
            <TeamIdentity team={match.home} align="left" />
            <div className="text-center">
              {finished || live ? (
                <p className="font-display text-4xl font-bold tabular-nums text-white sm:text-6xl">
                  {match.home?.goals ?? '—'}<span className="mx-2 text-pitch-muted">–</span>{match.away?.goals ?? '—'}
                </p>
              ) : (
                <p className="font-display text-2xl font-bold text-pitch-muted sm:text-3xl">VS</p>
              )}
              <time dateTime={match.kickoffAt} className="mt-2 block text-xs text-pitch-muted sm:text-sm">
                {kickoff.toLocaleString('es-ES', {
                  timeZone: 'Europe/Madrid',
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              {match.hasPenalties && finished && (match.home?.penaltyGoals != null || match.away?.penaltyGoals != null) && (
                <p className="mt-1 text-xs text-pitch-muted">
                  Penaltis {match.home?.penaltyGoals ?? '—'}–{match.away?.penaltyGoals ?? '—'}
                </p>
              )}
            </div>
            <TeamIdentity team={match.away} align="right" />
          </div>
        </div>
      </header>

      <section aria-labelledby="eventos-partido">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="eventos-partido" className="text-sm font-semibold uppercase tracking-wide text-pitch-muted">Eventos</h2>
          <span className="fs-chip">{match.events.length}</span>
        </div>
        {match.events.length > 0 ? (
          <ol className="fs-panel divide-y divide-pitch-border/60">
            {match.events.map((event) => (
              <li key={event.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 px-4 py-3 text-sm">
                <span className="font-display font-bold tabular-nums text-pitch-accent">
                  {event.minute}&apos;{event.extraMinute != null ? `+${event.extraMinute}` : ''}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-white">{EVENT_LABEL[event.type] ?? event.type}</p>
                  <p className="mt-0.5 text-xs text-pitch-muted">
                    {event.player != null ? (
                      <Link href={`/jugadores/${event.player.slug}`} className="text-pitch-subtle hover:text-pitch-accent">{event.player.name}</Link>
                    ) : (
                      'Jugador no identificado'
                    )}
                    {event.assistPlayer != null && (
                      <> · Asistencia de <Link href={`/jugadores/${event.assistPlayer.slug}`} className="text-pitch-subtle hover:text-pitch-accent">{event.assistPlayer.name}</Link></>
                    )}
                    {event.detail != null && <> · {event.detail}</>}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState text={finished ? 'No hay eventos detallados sincronizados para este encuentro.' : 'Los eventos aparecerán cuando el proveedor publique el desarrollo del partido.'} />
        )}
      </section>

      <section aria-labelledby="alineaciones-partido">
        <h2 id="alineaciones-partido" className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Alineaciones</h2>
        {match.players.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <Lineup title={match.home?.name ?? 'Local'} players={homePlayers} />
            <Lineup title={match.away?.name ?? 'Visitante'} players={awayPlayers} />
          </div>
        ) : (
          <EmptyState text="Las alineaciones todavía no están disponibles para este partido." />
        )}
      </section>

      <section aria-labelledby="estadisticas-jugadores">
        <h2 id="estadisticas-jugadores" className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Estadísticas de jugadores</h2>
        {hasPlayerStats ? (
          <div className="overflow-x-auto rounded-xl border border-pitch-border">
            <table className="w-full min-w-[760px] bg-pitch-card text-sm">
              <thead className="border-b border-pitch-border text-left text-xs uppercase text-pitch-muted">
                <tr>
                  <th className="px-3 py-2">Jugador</th>
                  <th className="px-3 py-2">Equipo</th>
                  <th className="px-3 py-2 text-right">Min</th>
                  <th className="px-3 py-2 text-right">Nota</th>
                  <th className="px-3 py-2 text-right">G</th>
                  <th className="px-3 py-2 text-right">A</th>
                  <th className="px-3 py-2 text-right">Tiros</th>
                  <th className="px-3 py-2 text-right">Pases</th>
                  <th className="px-3 py-2 text-right">Paradas</th>
                  <th className="px-3 py-2 text-right">Tarjetas</th>
                </tr>
              </thead>
              <tbody>
                {match.players.filter((player) => player.minutesPlayed > 0).map((player) => (
                  <tr key={player.id} className="border-b border-pitch-border/50 last:border-0">
                    <td className="px-3 py-2 font-medium text-white">
                      <Link href={`/jugadores/${player.slug}`} className="hover:text-pitch-accent">{player.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-pitch-muted">{player.teamName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{player.minutesPlayed}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{player.rating?.toFixed(1) ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{player.fieldStats?.goals ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{player.fieldStats?.assists ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {player.fieldStats?.shotsOnTarget ?? '—'}/{player.fieldStats?.shotsTotal ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {player.fieldStats?.passesCompleted ?? '—'}/{player.fieldStats?.passesAttempted ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{player.goalkeeperStats?.saves ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(player.fieldStats?.yellowCards ?? 0) + (player.fieldStats?.redCards ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text={finished ? 'No hay estadísticas individuales sincronizadas para este encuentro.' : 'Las estadísticas aparecerán después del partido.'} />
        )}
      </section>
    </div>
  );
}

function Lineup({ title, players }: { title: string; players: MatchDetailPlayer[] }) {
  const starters = players.filter((player) => player.role === 'STARTER');
  const substitutes = players.filter((player) => player.role !== 'STARTER');
  return (
    <article className="fs-panel overflow-hidden">
      <h3 className="border-b border-pitch-border px-4 py-3 font-display font-semibold text-white">{title}</h3>
      <div className="grid gap-5 p-4 sm:grid-cols-2">
        <PlayerGroup title="Titulares" players={starters} />
        <PlayerGroup title="Banquillo" players={substitutes} />
      </div>
    </article>
  );
}

function PlayerGroup({ title, players }: { title: string; players: MatchDetailPlayer[] }) {
  return (
    <div>
      <h4 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-pitch-muted">{title}</h4>
      {players.length > 0 ? (
        <ul className="space-y-1.5">
          {players.map((player) => (
            <li key={player.id} className="flex items-center gap-2 rounded-lg bg-pitch-elevated/70 px-2.5 py-2 text-xs">
              <span className="w-6 text-center font-semibold tabular-nums text-pitch-muted">{player.shirtNumber ?? '—'}</span>
              <Link href={`/jugadores/${player.slug}`} className="min-w-0 flex-1 truncate font-medium text-white hover:text-pitch-accent">
                {player.name}{player.isCaptain ? ' (C)' : ''}
              </Link>
              <span className="text-2xs text-pitch-muted">{player.positionPlayed ?? ROLE_LABEL[player.role] ?? player.role}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-pitch-muted">Sin datos.</p>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="fs-panel border-dashed px-5 py-8 text-center text-sm text-pitch-muted">{text}</p>;
}
