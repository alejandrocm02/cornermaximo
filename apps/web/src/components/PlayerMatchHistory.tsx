import Link from 'next/link';
import Form from 'next/form';
import { Fragment, type ReactNode } from 'react';
import { HistoryCrest } from '@/components/HistoryCrest';
import { roundLabel } from '@/lib/football';
import {
  FIELD_METRICS, GOALKEEPER_METRICS, historyParticipation, historyPosition, summarizeHistoryMetric,
  type HistoryFilters, type HistoryMatch,
} from '@/lib/matchHistory';

interface Props {
  slug: string;
  playerName: string;
  isGoalkeeper: boolean;
  matches: HistoryMatch[];
  filters: HistoryFilters;
  options: {
    competitions: Array<{ id: number; name: string }>;
    years: Array<{ year: number; label: string }>;
  };
  from?: string;
}

const number = (value: number | null) => value == null ? '—' : value.toLocaleString('es-ES', { maximumFractionDigits: 2 });
const date = (value: string) => new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', timeZone: 'Europe/Madrid' });

export function PlayerMatchHistory({ slug, playerName, isGoalkeeper, matches, filters, options, from }: Props) {
  const played = matches.filter((match) => match.minutes > 0);
  const metrics = isGoalkeeper ? GOALKEEPER_METRICS : FIELD_METRICS;
  const resetHref = `/jugadores/${slug}${from ? `?desde=${encodeURIComponent(from)}` : ''}#partido-a-partido`;
  return (
    <section id="partido-a-partido" aria-labelledby="match-history-title" className="min-w-0 scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="cm-kicker">CM · Rendimiento</p>
          <h2 id="match-history-title" className="mt-2 text-2xl font-bold">Partido a partido</h2>
          <p className="mt-1 text-sm text-pitch-muted">Compara el rendimiento de {playerName} en cada encuentro.</p>
        </div>
        <span className="rounded-full border border-pitch-border bg-pitch-elevated px-3 py-1.5 text-xs text-pitch-subtle">Más recientes primero</span>
      </div>

      <Form action={`/jugadores/${slug}#partido-a-partido`} scroll={false} className="cm-toolbar grid items-end gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[.8fr_1fr_1.4fr_1fr_auto]">
        {from && <input type="hidden" name="desde" value={from} />}
        <Filter label="Historial" name="partidos" value={String(filters.count)}>
          {[5, 10, 20].map((count) => <option key={count} value={count}>Últimos {count}</option>)}
        </Filter>
        <Filter label="Temporada" name="temporada" value={filters.year?.toString() ?? ''}>
          <option value="">Todas</option>
          {options.years.map((item) => <option key={item.year} value={item.year}>{item.label}</option>)}
        </Filter>
        <Filter label="Competición" name="competicion" value={filters.competitionId?.toString() ?? ''}>
          <option value="">Todas</option>
          {options.competitions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Filter>
        <Filter label="Sede" name="sede" value={filters.venue}>
          <option value="all">Local y visitante</option>
          <option value="home">Local</option>
          <option value="away">Visitante</option>
        </Filter>
        <button type="submit" className="fs-btn-primary">Aplicar filtros</button>
      </Form>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-pitch-muted">
          <strong className="text-white">{matches.length}</strong> encuentros registrados
          <span className="mx-2" aria-hidden="true">·</span>
          <strong className="text-white">{played.length}</strong> con minutos
          <span className="mx-2" aria-hidden="true">·</span>
          <strong className="text-white">{played.reduce((sum, match) => sum + match.minutes, 0)}</strong> min
        </p>
        <Link href={resetHref} scroll={false} className="rounded text-pitch-subtle underline decoration-pitch-border-strong underline-offset-4 hover:text-white">Restablecer filtros</Link>
      </div>

      {!matches.length ? (
        <div className="fs-panel p-8 text-center">
          <p className="font-semibold">No hay partidos registrados para esta selección.</p>
          <p className="mt-2 text-sm text-pitch-muted">Prueba otra temporada o amplía los filtros. Los partidos aparecerán cuando estén finalizados y sincronizados.</p>
        </div>
      ) : (
        <div className="fs-panel overflow-hidden">
          <div role="region" aria-label="Estadísticas por partido, tabla desplazable" aria-describedby="history-help" tabIndex={0} className="cm-match-history-scroll">
            <table className="cm-match-history">
              <caption className="sr-only">Estadísticas de {playerName}. Columnas por partido; medias de la selección bajo cada métrica.</caption>
              <thead>
                <tr>
                  <th scope="col" className="cm-history-label">
                    <span className="block text-sm font-semibold text-white">Estadística</span>
                    <span className="mt-2 block text-xs font-normal text-pitch-muted">Media · Por 90 min</span>
                  </th>
                  {matches.map((match) => <th key={match.id} scope="col"><MatchHeading match={match} /></th>)}
                </tr>
              </thead>
              <tbody>
                <InfoRow label="Participación" matches={matches} render={(match) => <span className={match.minutes > 0 ? 'text-pitch-subtle' : 'text-pitch-muted'}>{historyParticipation(match)}</span>} />
                <InfoRow label="Minutos" matches={matches} render={(match) => <strong>{match.minutes}′</strong>} />
                <InfoRow label="Posición" matches={matches} render={(match) => match.minutes > 0 ? historyPosition(match.position) : '—'} />
                <InfoRow label="Valoración" matches={matches} render={(match) => match.minutes > 0 && match.rating != null ? <span className="rounded-lg border border-pitch-accent/30 bg-pitch-accent/10 px-2.5 py-1 font-semibold text-white">{number(match.rating)}</span> : '—'} />
                {metrics.map((metric, index) => {
                  const summary = summarizeHistoryMetric(matches, metric.key);
                  return (
                    <Fragment key={metric.key}>
                      {metrics[index - 1]?.group !== metric.group && (
                        <tr className="cm-history-group">
                          <th scope="row" className="cm-history-label">{metric.group}</th>
                          <td colSpan={matches.length} aria-hidden="true" />
                        </tr>
                      )}
                      <tr>
                        <th scope="row" className="cm-history-label">
                          <span className="block font-medium text-pitch-subtle">{metric.label}</span>
                          <span className="mt-1 flex flex-wrap gap-x-2 text-xs font-normal text-pitch-muted" title={`Cálculo sobre ${summary.sample} partidos con minutos y datos disponibles`}>
                            <span><span className="sr-only">Media: </span>{number(summary.average)}</span>
                            <span aria-hidden="true">·</span>
                            <span><span className="sr-only">Por 90 minutos: </span>{number(summary.per90)}</span>
                            <span className="sr-only">. {summary.sample} partidos con datos.</span>
                          </span>
                        </th>
                        {matches.map((match) => {
                          const value = match.minutes > 0 ? match.stats[metric.key] ?? null : null;
                          return <td key={match.id}><span className={value == null ? 'text-pitch-muted' : value > 0 ? 'font-semibold text-white' : 'text-pitch-subtle'}>{value == null ? <><span aria-hidden="true">—</span><span className="sr-only">{match.minutes > 0 ? 'Dato no disponible' : 'Sin participación'}</span></> : value}</span></td>;
                        })}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p id="history-help" className="border-t border-pitch-border px-4 py-3 text-xs leading-relaxed text-pitch-muted">
            Desliza la tabla para ver más partidos. Media y por 90 calculados sobre la selección, solo con minutos y datos disponibles para cada métrica. 0 = ningún registro de esa acción; — = sin dato o sin participación. Solo se muestran encuentros registrados, no todas las ausencias del jugador.
          </p>
        </div>
      )}
    </section>
  );
}

function Filter({ label, name, value, children }: { label: string; name: string; value: string; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1.5 text-sm text-pitch-subtle"><label htmlFor={`history-${name}`}>{label}</label><select id={`history-${name}`} key={value} name={name} defaultValue={value} className="fs-input min-w-0">{children}</select></div>;
}

function InfoRow({ label, matches, render }: { label: string; matches: HistoryMatch[]; render: (match: HistoryMatch) => ReactNode }) {
  return <tr><th scope="row" className="cm-history-label font-medium text-pitch-subtle">{label}</th>{matches.map((match) => <td key={match.id}>{render(match)}</td>)}</tr>;
}

function MatchHeading({ match }: { match: HistoryMatch }) {
  const own = match.isHome ? match.home : match.away;
  const rival = match.isHome ? match.away : match.home;
  const outcome = own.goals == null || rival.goals == null ? null : own.goals > rival.goals ? 'Victoria' : own.goals < rival.goals ? 'Derrota' : 'Empate';
  return (
    <Link href={`/partidos/${match.id}`} prefetch={false} className="cm-history-match-link" aria-label={`Abrir partido ${match.home.name} ${match.home.goals ?? '—'} a ${match.away.goals ?? '—'} ${match.away.name}, ${date(match.date)}, ${match.season}`}>
      <time dateTime={match.date} className="text-sm font-semibold text-white">{date(match.date)}</time>
      <span className="text-xs font-normal text-pitch-muted">{match.competition} · {match.season}</span>
      <span className="mt-1 flex items-center justify-center gap-2"><HistoryCrest name={match.home.name} url={match.home.crestUrl} /><HistoryCrest name={match.away.name} url={match.away.crestUrl} /></span>
      <span className="font-display text-lg font-bold text-white">{match.home.goals ?? '—'} – {match.away.goals ?? '—'}</span>
      <span className="text-sm font-medium text-pitch-subtle">{match.isHome ? 'vs' : '@'} {rival.name}</span>
      <span className={`text-xs font-normal ${outcome === 'Derrota' ? 'text-pitch-danger' : 'text-pitch-muted'}`}>{match.isHome ? 'Local' : 'Visitante'}{outcome ? ` · ${outcome}` : ''}</span>
      {roundLabel(match.round) && <span className="text-xs font-normal text-pitch-muted">{roundLabel(match.round)}</span>}
    </Link>
  );
}
