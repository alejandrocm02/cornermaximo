import { prisma } from '@futstats/db';
import { ALL_TRACKED_SEASONS, BIG_FIVE_PREVIOUS_SEASON, seasonsOf, type SeasonFormat } from '@futstats/shared';
import Link from 'next/link';
import { seasonLabel } from '@/lib/football';
import { rankingRows, type RankingMetric } from '@/lib/leaderboards';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: { absolute: 'Ranking de goleadores, asistencias y estadísticas | FutStats' },
  description:
    'Rankings de goles, asistencias, pases clave y paradas por liga y temporada, con datos actualizados automáticamente.',
  alternates: { canonical: '/rankings' },
};

const METRICS: Array<{ value: RankingMetric; label: string; unit: string }> = [
  { value: 'goals', label: 'Goles', unit: 'goles' },
  { value: 'assists', label: 'Asistencias', unit: 'asistencias' },
  { value: 'keyPasses', label: 'Pases clave', unit: 'pases clave' },
  { value: 'shotsOnTarget', label: 'Tiros a puerta', unit: 'tiros a puerta' },
  { value: 'tacklesWon', label: 'Entradas ganadas', unit: 'entradas ganadas' },
  { value: 'interceptions', label: 'Intercepciones', unit: 'intercepciones' },
  { value: 'saves', label: 'Paradas (porteros)', unit: 'paradas' },
];

function per90(total: number, minutes: number): string {
  if (minutes <= 0) return '—';
  return ((total / minutes) * 90).toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; league?: string; temporada?: string }>;
}) {
  const sp = await searchParams;
  const metricDef = METRICS.find((m) => m.value === sp.metric) ?? METRICS[0]!;
  const league = (sp.league ?? '').slice(0, 50);

  // Las temporadas disponibles dependen de la competición: una liga de año
  // natural (Eliteserien, MLS, Brasileirão) no comparte calendario con LaLiga.
  // Sin liga seleccionada se ofrece la unión de todas las rastreadas.
  const availableSeasons = league === '' ? ALL_TRACKED_SEASONS : seasonsOf(league);
  const requestedSeason = Number(sp.temporada);
  const season = availableSeasons.includes(requestedSeason)
    ? requestedSeason
    : // por defecto, la última temporada completada (la que ya tiene datos)
      (availableSeasons[0] ?? BIG_FIVE_PREVIOUS_SEASON);

  const [leagues, rows, lastSync] = await Promise.all([
    prisma.competition.findMany({ where: { type: 'LEAGUE' }, orderBy: { name: 'asc' } }),
    rankingRows({ metric: metricDef.value, league: league === '' ? undefined : league, season, limit: 25 }).catch(
      () => null, // estado de error controlado
    ),
    prisma.playerMatchStatistics.aggregate({ _max: { syncedAt: true } }),
  ]);

  const selectedLeague = leagues.find((l) => l.slug === league);
  const leagueName = league === '' ? 'todas las ligas' : selectedLeague?.name ?? league;
  const updatedAt = lastSync._max.syncedAt;
  const leader = rows?.[0];

  // Formato de etiqueta de temporada. Con una liga seleccionada se usa el suyo;
  // sin filtro se asume temporada partida, que es el formato mayoritario.
  const fmt: SeasonFormat = selectedLeague?.seasonFormat ?? 'SPLIT_YEAR';
  const label = (year: number) => seasonLabel(year, fmt);

  const itemListJsonLd =
    rows != null && rows.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `Ranking de ${metricDef.label.toLowerCase()} · ${leagueName} · ${label(season)}`,
          itemListElement: rows.slice(0, 10).map((r, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: r.name,
            url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/jugadores/${r.slug}`,
          })),
        }
      : null;

  return (
    <div className="space-y-6">
      {itemListJsonLd != null && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}
      <div>
        <p className="fs-eyebrow">
          <span aria-hidden="true" className="h-1 w-4 rounded-full bg-grad-brand" />
          Rankings
        </p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
          Ranking de {metricDef.label.toLowerCase()} · {leagueName} · {label(season)}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-pitch-muted">
          Consulta los futbolistas con mejores registros de la temporada seleccionada. Los datos se
          actualizan automáticamente.
        </p>
        {updatedAt != null && (
          <p className="mt-1 text-xs text-pitch-muted">
            Datos actualizados: {updatedAt.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </div>

      <form method="GET" action="/rankings" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Tipo de ranking</span>
          <select name="metric" defaultValue={metricDef.value} className="w-full rounded-lg border border-pitch-border bg-pitch-card/80 px-3 py-2.5 text-white outline-none transition focus:border-pitch-accent/60 sm:w-auto">
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Liga</span>
          <select name="league" defaultValue={league} className="w-full rounded-lg border border-pitch-border bg-pitch-card/80 px-3 py-2.5 text-white outline-none transition focus:border-pitch-accent/60 sm:w-auto">
            <option value="">Todas las ligas</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.slug}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Temporada</span>
          <select name="temporada" defaultValue={String(season)} className="w-full rounded-lg border border-pitch-border bg-pitch-card/80 px-3 py-2.5 text-white outline-none transition focus:border-pitch-accent/60 sm:w-auto">
            {availableSeasons.map((y) => (
              <option key={y} value={y}>{label(y)}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-pitch-accent px-4 py-2 font-medium text-black">Ver ranking</button>
      </form>

      {rows == null && (
        <div role="alert" className="rounded-xl border border-pitch-danger/40 bg-pitch-danger/10 px-4 py-3 text-sm text-pitch-danger">
          No se pudo cargar el ranking. Recarga la página para intentarlo de nuevo.
        </div>
      )}

      {leader != null && (
        <p className="rounded-xl border border-pitch-accent/40 bg-pitch-accent/10 px-4 py-3 text-sm">
          <Link href={`/jugadores/${leader.slug}`} className="font-semibold hover:underline">{leader.name}</Link>{' '}
          lidera el ranking con {leader.total.toLocaleString('es-ES')} {metricDef.unit}.
        </p>
      )}

      {rows != null && (
        <>
        <p className="mb-1 text-xs text-pitch-muted sm:hidden" aria-hidden="true">Desliza la tabla lateralmente para ver todas las columnas →</p>
        <div className="fs-panel overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">
              Ranking de {metricDef.label.toLowerCase()} en {leagueName}, temporada {label(season)}
            </caption>
            <thead className="border-b border-pitch-border/60 bg-pitch-elevated/40 text-left text-2xs uppercase tracking-[0.14em] text-pitch-muted">
              <tr className="border-b border-pitch-border">
                <th scope="col" className="px-4 py-2">#</th>
                <th scope="col" className="px-4 py-2">Jugador</th>
                <th scope="col" className="px-4 py-2">Equipo</th>
                <th scope="col" className="px-4 py-2 text-right">{metricDef.label}</th>
                <th scope="col" className="px-4 py-2 text-right">Minutos</th>
                <th scope="col" className="px-4 py-2 text-right">Por 90&apos;</th>
                <th scope="col" className="px-4 py-2"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.slug} className="border-b border-pitch-border/50 last:border-0">
                  <td className="px-4 py-2 text-pitch-muted">{i + 1}</td>
                  <th scope="row" className="px-4 py-2 text-left font-medium">
                    <Link href={`/jugadores/${r.slug}`} className="hover:text-pitch-accent">{r.name}</Link>
                  </th>
                  <td className="px-4 py-2 text-pitch-muted">{r.team ?? '—'}</td>
                  <td className="px-4 py-2 text-right font-semibold text-pitch-accent">{r.total.toLocaleString('es-ES')}</td>
                  <td className="px-4 py-2 text-right text-pitch-muted">{r.minutes.toLocaleString('es-ES')}</td>
                  <td className="px-4 py-2 text-right text-pitch-muted">{per90(r.total, r.minutes)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/comparador?p1=${r.slug}`}
                      className="rounded-lg border border-pitch-border px-3 py-1 text-xs text-pitch-muted outline-none hover:border-pitch-accent hover:text-white focus-visible:ring-2 focus-visible:ring-pitch-accent"
                    >
                      Comparar
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-pitch-muted">
                    Todavía no hay datos para esta combinación de liga y temporada. Se incorporarán
                    automáticamente cuando la fuente los publique.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
