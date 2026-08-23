import { prisma } from '@cornermaximo/db';
import {
  ALL_TRACKED_SEASONS,
  BIG_FIVE_CURRENT_SEASON,
  currentSeasonOf,
  seasonsOf,
  type SeasonFormat,
} from '@cornermaximo/shared';
import Image from 'next/image';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { seasonLabel } from '@/lib/football';
import { rankingRows, type RankingMetric } from '@/lib/leaderboards';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: { absolute: 'Rankings 2026/27: jugadores y estadísticas | CornerMaximo' },
  description:
    'Centro de rankings de CornerMaximo: goles, asistencias, ratings, entradas, faltas, paradas y más, por liga, temporada y posición.',
  alternates: { canonical: '/rankings' },
};

type MetricDef = {
  value: RankingMetric;
  label: string;
  short: string;
  unit: string;
  group: 'Ataque' | 'Creación' | 'Defensa' | 'Disciplina' | 'Porteros' | 'Rendimiento';
  mode?: 'average' | 'minutes';
};

const METRICS: MetricDef[] = [
  { value: 'goals', label: 'Goles', short: 'GOL', unit: 'goles', group: 'Ataque' },
  { value: 'assists', label: 'Asistencias', short: 'AST', unit: 'asistencias', group: 'Ataque' },
  { value: 'shotsOnTarget', label: 'Tiros a puerta', short: 'TAP', unit: 'tiros a puerta', group: 'Ataque' },
  { value: 'keyPasses', label: 'Pases clave', short: 'PCL', unit: 'pases clave', group: 'Creación' },
  { value: 'tackles', label: 'Entradas', short: 'ENT', unit: 'entradas', group: 'Defensa' },
  { value: 'interceptions', label: 'Intercepciones', short: 'INT', unit: 'intercepciones', group: 'Defensa' },
  { value: 'foulsDrawn', label: 'Faltas recibidas', short: 'FRC', unit: 'faltas recibidas', group: 'Disciplina' },
  { value: 'foulsCommitted', label: 'Faltas cometidas', short: 'FCO', unit: 'faltas cometidas', group: 'Disciplina' },
  { value: 'yellowCards', label: 'Tarjetas amarillas', short: 'TA', unit: 'amarillas', group: 'Disciplina' },
  { value: 'saves', label: 'Paradas', short: 'PAR', unit: 'paradas', group: 'Porteros' },
  { value: 'cleanSheets', label: 'Porterías a cero', short: 'PAC', unit: 'porterías a cero', group: 'Porteros' },
  { value: 'rating', label: 'Valoración media', short: 'RAT', unit: 'de valoración', group: 'Rendimiento', mode: 'average' },
  { value: 'minutes', label: 'Minutos', short: 'MIN', unit: 'minutos', group: 'Rendimiento', mode: 'minutes' },
];

const POSITION_OPTIONS = [
  ['', 'Todas las posiciones'],
  ['GK', 'Porteros'],
  ['DF', 'Defensas'],
  ['MF', 'Centrocampistas'],
  ['FW', 'Delanteros'],
] as const;

const POSITION_LABEL: Record<string, string> = { GK: 'POR', DF: 'DEF', MF: 'MED', FW: 'DEL' };

function displayValue(metric: MetricDef, value: number): string {
  if (metric.mode === 'average') return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value.toLocaleString('es-ES', { maximumFractionDigits: 0 });
}

function secondaryMetric(metric: MetricDef, total: number, minutes: number): string {
  if (metric.mode === 'average') return `${minutes.toLocaleString('es-ES')} min`;
  if (metric.mode === 'minutes') return '—';
  if (minutes <= 0) return '—';
  return `${((total / minutes) * 90).toLocaleString('es-ES', { maximumFractionDigits: 2 })} /90`;
}

function PlayerAvatar({ name, photoUrl, size = 'md' }: { name: string; photoUrl: string | null; size?: 'md' | 'lg' }) {
  const classes = size === 'lg' ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-10 w-10';
  return photoUrl != null ? (
    <Image src={photoUrl} alt="" width={96} height={96} className={`${classes} rounded-full object-cover ring-1 ring-white/15`} />
  ) : (
    <span className={`${classes} grid shrink-0 place-items-center rounded-full bg-pitch-elevated font-display font-bold text-pitch-muted ring-1 ring-pitch-border`}>
      {name.slice(0, 1)}
    </span>
  );
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; league?: string; temporada?: string; posicion?: string }>;
}) {
  const sp = await searchParams;
  const metric = METRICS.find((item) => item.value === sp.metric) ?? METRICS[0]!;
  const league = (sp.league ?? '').slice(0, 50).trim();
  const position = POSITION_OPTIONS.some(([value]) => value === sp.posicion) ? (sp.posicion ?? '') : '';

  const availableSeasons = league === ''
    ? [...ALL_TRACKED_SEASONS]
    : [...seasonsOf(league)].sort((a, b) => b - a);
  const requestedSeason = Number(sp.temporada);
  const defaultSeason = league === '' ? (ALL_TRACKED_SEASONS[0] ?? BIG_FIVE_CURRENT_SEASON) : currentSeasonOf(league);
  const season = availableSeasons.includes(requestedSeason) ? requestedSeason : defaultSeason;

  const [leagues, rows, lastSync] = await Promise.all([
    prisma.competition.findMany({
      where: { type: 'LEAGUE', seasons: { some: { isCurrent: true } } },
      select: { id: true, slug: true, name: true, seasonFormat: true },
      orderBy: { name: 'asc' },
    }),
    rankingRows({
      metric: metric.value,
      league: league === '' ? undefined : league,
      season,
      position: position === '' ? undefined : position,
      limit: 50,
    }).catch(() => null),
    prisma.playerMatchStatistics.aggregate({ _max: { syncedAt: true } }),
  ]);

  const selectedLeague = leagues.find((item) => item.slug === league);
  const leagueName = league === '' ? 'Todas las ligas' : selectedLeague?.name ?? league;
  const format: SeasonFormat = selectedLeague?.seasonFormat ?? 'SPLIT_YEAR';
  const label = (year: number) => seasonLabel(year, format);
  const podium = rows?.slice(0, 3) ?? [];
  const updatedAt = lastSync._max.syncedAt;

  const jsonLd = rows != null && rows.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${metric.label} · ${leagueName} · ${label(season)}`,
    itemListElement: rows.slice(0, 10).map((row, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: row.name,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/jugadores/${row.slug}`,
    })),
  } : null;

  return (
    <div className="cm-page space-y-7">
      {jsonLd != null && <JsonLd data={jsonLd} />}

      <header className="cm-hero-panel overflow-hidden p-5 sm:p-7 lg:p-9">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="cm-kicker">CM Rankings</span>
              <span className="cm-live-dot"><span aria-hidden="true" /> Temporada vigente</span>
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-bold sm:text-5xl">
              El rendimiento de la <span className="fs-gradient-text">temporada actual</span>, sin mezclar históricos.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-pitch-muted sm:text-base">
              Podio, ranking completo y filtros profesionales por competición, posición y temporada. El histórico sigue disponible cuando quieras compararlo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[360px]">
            <div className="cm-kpi"><span>Temporada</span><strong>{label(season)}</strong></div>
            <div className="cm-kpi"><span>Métrica</span><strong>{metric.short}</strong></div>
            <div className="cm-kpi col-span-2 sm:col-span-1"><span>Universo</span><strong>{rows?.length ?? 0}</strong></div>
          </div>
        </div>
      </header>

      <form method="GET" action="/rankings" className="cm-toolbar grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <label className="cm-field">
          <span>Métrica</span>
          <select name="metric" defaultValue={metric.value}>
            {Array.from(new Set(METRICS.map((item) => item.group))).map((group) => (
              <optgroup key={group} label={group}>
                {METRICS.filter((item) => item.group === group).map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="cm-field">
          <span>Competición</span>
          <select name="league" defaultValue={league}>
            <option value="">Todas las ligas</option>
            {leagues.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </select>
        </label>
        <label className="cm-field">
          <span>Posición</span>
          <select name="posicion" defaultValue={position}>
            {POSITION_OPTIONS.map(([value, name]) => <option key={value || 'all'} value={value}>{name}</option>)}
          </select>
        </label>
        <label className="cm-field">
          <span>Temporada</span>
          <select name="temporada" defaultValue={String(season)}>
            {availableSeasons.map((year) => <option key={year} value={year}>{label(year)}{year === defaultSeason ? ' · actual' : ''}</option>)}
          </select>
        </label>
        <button type="submit" className="fs-btn-primary self-end">Actualizar</button>
      </form>

      {rows == null && (
        <div role="alert" className="rounded-2xl border border-pitch-danger/40 bg-pitch-danger/10 p-4 text-sm text-pitch-danger">
          No se pudo cargar el ranking en este momento. Inténtalo de nuevo.
        </div>
      )}

      {rows != null && rows.length > 0 && (
        <section aria-labelledby="podio-ranking">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div><p className="cm-kicker">Top 3</p><h2 id="podio-ranking" className="mt-1 text-2xl font-bold">Podio · {metric.label}</h2></div>
            {updatedAt != null && <p className="hidden text-xs text-pitch-muted sm:block">Actualizado {updatedAt.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {podium.map((row, index) => (
              <Link key={`${row.slug}-${row.team ?? ''}`} href={`/jugadores/${row.slug}`} className={`cm-podium-card group p-5 ${index === 0 ? 'md:-translate-y-2 md:border-pitch-accent/50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <PlayerAvatar name={row.name} photoUrl={row.photoUrl} size="lg" />
                  <span className={`cm-rank-medal cm-rank-${index + 1}`}>{index + 1}</span>
                </div>
                <p className="mt-5 truncate font-display text-xl font-bold text-white group-hover:text-pitch-accent">{row.name}</p>
                <p className="mt-1 truncate text-xs text-pitch-muted">{row.team ?? '—'}{row.position ? ` · ${POSITION_LABEL[row.position] ?? row.position}` : ''}</p>
                <div className="mt-5 flex items-end justify-between border-t border-white/8 pt-4">
                  <div><p className="text-3xl font-bold tabular-nums text-white">{displayValue(metric, row.total)}</p><p className="text-2xs uppercase tracking-widest text-pitch-muted">{metric.unit}</p></div>
                  <span className="cm-data-pill">{secondaryMetric(metric, row.total, row.minutes)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {rows != null && (
        <section aria-labelledby="tabla-ranking" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div><p className="cm-kicker">Clasificación</p><h2 id="tabla-ranking" className="mt-1 text-2xl font-bold">{leagueName} · {label(season)}</h2></div>
            <span className="cm-data-pill">{position ? POSITION_OPTIONS.find(([value]) => value === position)?.[1] : 'Todas las posiciones'}</span>
          </div>
          <p className="text-xs text-pitch-muted sm:hidden">Desliza lateralmente para ver todas las métricas →</p>
          <div className="cm-table-shell overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">Ranking de {metric.label.toLowerCase()} en {leagueName}, temporada {label(season)}</caption>
              <thead>
                <tr>
                  <th scope="col">#</th><th scope="col">Jugador</th><th scope="col">Equipo</th><th scope="col">PJ</th>
                  <th scope="col" className="text-right">{metric.label}</th><th scope="col" className="text-right">Minutos</th><th scope="col" className="text-right">Por 90&apos;</th><th scope="col" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.slug}-${row.team ?? ''}`}>
                    <td><span className={index < 3 ? `cm-table-rank cm-rank-${index + 1}` : 'cm-table-rank'}>{index + 1}</span></td>
                    <th scope="row">
                      <Link href={`/jugadores/${row.slug}`} className="flex items-center gap-3 font-semibold text-white hover:text-pitch-accent">
                        <PlayerAvatar name={row.name} photoUrl={row.photoUrl} /><span className="truncate">{row.name}</span>
                      </Link>
                    </th>
                    <td><span className="text-pitch-muted">{row.team ?? '—'}</span>{row.position && <span className="ml-2 cm-position-tag">{POSITION_LABEL[row.position] ?? row.position}</span>}</td>
                    <td className="tabular-nums text-pitch-muted">{row.appearances}</td>
                    <td className="text-right font-display text-base font-bold tabular-nums text-pitch-accent">{displayValue(metric, row.total)}</td>
                    <td className="text-right tabular-nums text-pitch-muted">{row.minutes.toLocaleString('es-ES')}</td>
                    <td className="text-right tabular-nums text-pitch-muted">{secondaryMetric(metric, row.total, row.minutes)}</td>
                    <td className="text-right"><Link href={`/comparador?p1=${row.slug}`} className="cm-inline-action">Comparar</Link></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-pitch-muted">Aún no hay datos oficiales para esta combinación. No se rellenan con estadísticas de otra temporada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
