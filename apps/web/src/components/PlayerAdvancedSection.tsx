import Link from 'next/link';
import type { PlayerAdvancedStats } from '@/lib/playerAdvancedStats';
import { PlayerPerformanceRadar } from '@/components/PlayerPerformanceRadar';

const POSITION_LABEL: Record<string, string> = {
  GK: 'porteros',
  DF: 'defensas',
  MF: 'centrocampistas',
  FW: 'delanteros',
};

function metricValue(value: number | null, unit: 'per90' | 'percent') {
  if (value == null) return '—';
  return unit === 'percent' ? `${value}%` : `${value}/90'`;
}

export function PlayerAdvancedSection({ data }: { data: PlayerAdvancedStats }) {
  if (data.metrics.length === 0 && data.evolution.length < 2) return null;

  const positionLabel = data.position == null ? 'jugadores' : (POSITION_LABEL[data.position] ?? 'jugadores');

  return (
    <section className="space-y-5" aria-labelledby="advanced-performance-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="fs-eyebrow">Jugador 2.0</p>
          <h2 id="advanced-performance-title" className="mt-1 font-display text-2xl font-bold text-white">
            Rendimiento avanzado
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-pitch-muted">
            Métricas normalizadas por 90 minutos y percentiles frente a {positionLabel}
            {data.competition != null ? <> de <Link className="text-pitch-accent hover:underline" href={`/ligas/${data.competition.slug}`}>{data.competition.name}</Link></> : null}.
            La cohorte exige al menos 450 minutos para reducir muestras poco representativas.
          </p>
        </div>
        <span className="fs-chip">{data.sampleSize} jugadores comparables</span>
      </div>

      {data.metrics.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.05fr]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.metrics.map((metric) => (
              <article key={metric.key} className="fs-panel p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-pitch-muted">{metric.label}</p>
                <p className="mt-2 font-display text-2xl font-bold text-white">{metricValue(metric.value, metric.unit)}</p>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span className="text-pitch-muted">{metric.unit === 'per90' ? 'Por 90 min' : 'Eficacia'}</span>
                  <span className={metric.percentile != null && metric.percentile >= 75 ? 'font-semibold text-pitch-accent' : 'font-semibold text-white'}>
                    {metric.percentile == null ? 'Percentil —' : `P${metric.percentile}`}
                  </span>
                </div>
              </article>
            ))}
          </div>
          <PlayerPerformanceRadar metrics={data.metrics} />
        </div>
      )}

      {data.evolution.length >= 2 && (
        <div className="fs-panel overflow-hidden">
          <div className="border-b border-pitch-border px-5 py-4">
            <h3 className="font-display text-lg font-bold text-white">Evolución por temporadas</h3>
            <p className="mt-1 text-xs text-pitch-muted">Hasta cinco temporadas con partidos sincronizados.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-pitch-muted">
                <tr>
                  <th className="px-5 py-3">Temporada</th>
                  <th className="px-3 py-3">Competición</th>
                  <th className="px-3 py-3 text-right">PJ</th>
                  <th className="px-3 py-3 text-right">Min</th>
                  <th className="px-3 py-3 text-right">Rating</th>
                  {data.position === 'GK' ? <th className="px-5 py-3 text-right">Paradas</th> : <><th className="px-3 py-3 text-right">Goles</th><th className="px-5 py-3 text-right">Asist.</th></>}
                </tr>
              </thead>
              <tbody className="divide-y divide-pitch-border">
                {data.evolution.map((season) => (
                  <tr key={`${season.competition}-${season.season}`}>
                    <td className="px-5 py-3 font-semibold text-white">{season.season}</td>
                    <td className="px-3 py-3 text-pitch-muted">{season.competition}</td>
                    <td className="px-3 py-3 text-right">{season.appearances}</td>
                    <td className="px-3 py-3 text-right">{season.minutes}</td>
                    <td className="px-3 py-3 text-right">{season.avgRating ?? '—'}</td>
                    {data.position === 'GK' ? <td className="px-5 py-3 text-right">{season.saves ?? '—'}</td> : <><td className="px-3 py-3 text-right">{season.goals ?? '—'}</td><td className="px-5 py-3 text-right">{season.assists ?? '—'}</td></>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs leading-5 text-pitch-muted">
        Percentil 90 significa que el jugador supera aproximadamente al 90% de la cohorte en esa métrica. Los valores dependen de la cobertura disponible del proveedor.
      </p>
    </section>
  );
}
