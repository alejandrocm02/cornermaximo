import { prisma } from '@futstats/db';
import { LEAGUE_SEASONS } from '@futstats/shared';
import Link from 'next/link';
import { seasonLabel } from '@/lib/football';
import { rankingRows, type RankingMetric } from '@/lib/leaderboards';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rankings' };

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
  const requestedSeason = Number(sp.temporada);
  const season = (LEAGUE_SEASONS as readonly number[]).includes(requestedSeason)
    ? requestedSeason
    : LEAGUE_SEASONS[0]; // por defecto, la última temporada completada (con datos)

  const [leagues, rows, lastSync] = await Promise.all([
    prisma.competition.findMany({ where: { type: 'LEAGUE' }, orderBy: { name: 'asc' } }),
    rankingRows({ metric: metricDef.value, league: league === '' ? undefined : league, season, limit: 25 }).catch(
      () => null, // estado de error controlado
    ),
    prisma.playerMatchStatistics.aggregate({ _max: { syncedAt: true } }),
  ]);

  const leagueName = league === '' ? 'todas las ligas' : leagues.find((l) => l.slug === league)?.name ?? league;
  const updatedAt = lastSync._max.syncedAt;
  const leader = rows?.[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Ranking de {metricDef.label.toLowerCase()} · {leagueName} · {seasonLabel(season)}
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
          <select name="metric" defaultValue={metricDef.value} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Liga</span>
          <select name="league" defaultValue={league} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
            <option value="">Todas las ligas</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.slug}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-pitch-muted">Temporada</span>
          <select name="temporada" defaultValue={String(season)} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
            {LEAGUE_SEASONS.map((y) => (
              <option key={y} value={y}>{seasonLabel(y)}</option>
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
        <div className="overflow-x-auto rounded-xl border border-pitch-border">
          <table className="w-full min-w-[560px] bg-pitch-card text-sm">
            <caption className="sr-only">
              Ranking de {metricDef.label.toLowerCase()} en {leagueName}, temporada {seasonLabel(season)}
            </caption>
            <thead className="text-left text-xs uppercase text-pitch-muted">
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
      )}
    </div>
  );
}
