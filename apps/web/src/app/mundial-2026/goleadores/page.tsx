import { WORLD_CUP_2026 } from '@futstats/shared';
import Link from 'next/link';
import { topPlayerStat, type WorldCupStatMetric } from '@/lib/worldCupStats';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mundial 2026 — Estadísticas individuales' };

const METRICS: Array<{ value: WorldCupStatMetric; label: string }> = [
  { value: 'goals', label: 'Goles' },
  { value: 'assists', label: 'Asistencias' },
  { value: 'shotsOnTarget', label: 'Tiros a puerta' },
  { value: 'keyPasses', label: 'Pases clave' },
  { value: 'dribblesCompleted', label: 'Regates completados' },
  { value: 'tacklesWon', label: 'Entradas ganadas' },
  { value: 'interceptions', label: 'Intercepciones' },
  { value: 'yellowCards', label: 'Tarjetas amarillas' },
  { value: 'redCards', label: 'Tarjetas rojas' },
  { value: 'saves', label: 'Paradas (porteros)' },
  { value: 'goalsConceded', label: 'Goles encajados (porteros)' },
  { value: 'penaltiesSaved', label: 'Penaltis parados (porteros)' },
];

export default async function WorldCupTopStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string }>;
}) {
  const { metric: metricParam } = await searchParams;
  const metric = (METRICS.find((m) => m.value === metricParam)?.value ?? 'goals') as WorldCupStatMetric;

  const rows = await topPlayerStat(WORLD_CUP_2026.slug, metric, 25);
  const currentLabel = METRICS.find((m) => m.value === metric)?.label ?? metric;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Mundial 2026', href: '/mundial-2026' }, { label: 'Estadísticas individuales' }]} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-pitch-accent">Mundial 2026</p>
        <h1 className="text-2xl font-bold">Estadísticas individuales</h1>
        <p className="text-sm text-pitch-muted">Acumulado real de todos los partidos disputados en el torneo, por jugador y selección.</p>
      </div>

      <form method="GET" className="flex flex-wrap gap-3 text-sm">
        <select name="metric" defaultValue={metric} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
          {METRICS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-pitch-accent px-4 py-2 font-medium text-black">Ver</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-pitch-border">
        <table className="w-full bg-pitch-card text-sm">
          <thead className="text-left text-xs uppercase text-pitch-muted">
            <tr className="border-b border-pitch-border">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Jugador</th>
              <th className="px-4 py-2">Selección</th>
              <th className="px-4 py-2 text-right">{currentLabel}</th>
              <th className="px-4 py-2 text-right">Minutos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.slug} className="border-b border-pitch-border/50 last:border-0">
                <td className="px-4 py-2 text-pitch-muted">{i + 1}</td>
                <td className="px-4 py-2">
                  <Link href={`/jugadores/${r.slug}`} className="hover:text-pitch-accent">{r.name}</Link>
                </td>
                <td className="px-4 py-2 text-pitch-muted">
                  {r.teamSlug != null ? (
                    <Link href={`/equipos/${r.teamSlug}`} className="hover:text-pitch-accent">{r.team}</Link>
                  ) : (
                    r.team ?? '—'
                  )}
                </td>
                <td className="px-4 py-2 text-right font-semibold">{r.total}</td>
                <td className="px-4 py-2 text-right text-pitch-muted">{r.minutes}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-pitch-muted">
                  Sin datos todavía. Aparecerán en cuanto se sincronicen estadísticas de partidos del Mundial.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
