import Link from 'next/link';
import type { PlayerAdvancedAnalytics as Analytics, AdvancedMetric } from '@/lib/playerAdvanced';

const POSITION_LABEL = { GK: 'porteros', DF: 'defensas', MF: 'centrocampistas', FW: 'delanteros' } as const;

function radarPoint(index: number, total: number, percentile: number, radius: number, cx: number, cy: number) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / total;
  const scaled = radius * Math.max(0, Math.min(100, percentile)) / 100;
  return `${cx + Math.cos(angle) * scaled},${cy + Math.sin(angle) * scaled}`;
}

function ringPoints(total: number, factor: number, radius: number, cx: number, cy: number) {
  return Array.from({ length: total }, (_, index) => radarPoint(index, total, factor * 100, radius, cx, cy)).join(' ');
}

function shortLabel(label: string) {
  return label.replace(' /90', '').replace('Entradas ganadas', 'Entradas').replace('Duelos ganados', 'Duelos').replace('Goles encajados', 'Encajados').replace('Porterías a cero', 'P. a cero').replace('Balones aéreos', 'Aéreos').replace('Balones largos', 'Largos');
}

function Radar({ metrics }: { metrics: AdvancedMetric[] }) {
  const usable = metrics.filter((metric) => metric.percentile != null);
  if (usable.length < 3) {
    return <p className="grid min-h-64 place-items-center text-center text-sm text-pitch-muted">Aún no hay muestra suficiente para construir el radar.</p>;
  }

  const width = 420;
  const height = 330;
  const cx = 210;
  const cy = 165;
  const radius = 112;
  const playerPoints = usable.map((metric, index) => radarPoint(index, usable.length, metric.percentile ?? 0, radius, cx, cy)).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Radar de percentiles posicionales" className="mx-auto w-full max-w-md overflow-visible">
      {[0.25, 0.5, 0.75, 1].map((factor) => (
        <polygon key={factor} points={ringPoints(usable.length, factor, radius, cx, cy)} className="fill-none stroke-pitch-border" strokeWidth="1" />
      ))}
      {usable.map((_, index) => {
        const end = radarPoint(index, usable.length, 100, radius, cx, cy).split(',').map(Number);
        return <line key={index} x1={cx} y1={cy} x2={end[0]} y2={end[1]} className="stroke-pitch-border" strokeWidth="1" />;
      })}
      <polygon points={playerPoints} className="fill-pitch-accent/20 stroke-pitch-accent" strokeWidth="2.5" />
      {usable.map((metric, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / usable.length;
        const labelRadius = radius + 38;
        const x = cx + Math.cos(angle) * labelRadius;
        const y = cy + Math.sin(angle) * labelRadius;
        const anchor = Math.cos(angle) > 0.25 ? 'start' : Math.cos(angle) < -0.25 ? 'end' : 'middle';
        return (
          <g key={metric.key}>
            <text x={x} y={y - 3} textAnchor={anchor} className="fill-pitch-muted text-[11px]">{shortLabel(metric.label)}</text>
            <text x={x} y={y + 12} textAnchor={anchor} className="fill-white text-[11px] font-bold">P{metric.percentile}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Evolution({ form }: { form: Analytics['form'] }) {
  const chronological = [...form].reverse();
  const rated = chronological.filter((item) => item.rating != null);
  if (rated.length < 2) {
    return <p className="grid min-h-40 place-items-center text-center text-sm text-pitch-muted">Todavía no hay suficientes valoraciones para dibujar la evolución.</p>;
  }

  const width = 640;
  const height = 170;
  const left = 28;
  const right = 18;
  const top = 18;
  const bottom = 30;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const x = (index: number) => left + (index * chartWidth) / Math.max(1, rated.length - 1);
  const y = (rating: number) => top + ((10 - Math.max(5, Math.min(10, rating))) / 5) * chartHeight;
  const points = rated.map((item, index) => `${x(index)},${y(item.rating ?? 5)}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución de valoraciones en los últimos partidos" className="w-full">
        {[6, 7, 8, 9].map((rating) => (
          <g key={rating}>
            <line x1={left} x2={width - right} y1={y(rating)} y2={y(rating)} className="stroke-pitch-border" strokeWidth="1" strokeDasharray="4 5" />
            <text x="2" y={y(rating) + 4} className="fill-pitch-muted text-[10px]">{rating}</text>
          </g>
        ))}
        <polyline points={points} fill="none" className="stroke-pitch-accent" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {rated.map((item, index) => (
          <g key={item.matchId}>
            <circle cx={x(index)} cy={y(item.rating ?? 5)} r="4" className="fill-pitch-bg stroke-pitch-accent" strokeWidth="2" />
            <text x={x(index)} y={height - 8} textAnchor="middle" className="fill-pitch-muted text-[9px]">
              {new Date(item.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-2">
        {form.slice(0, 5).map((item) => (
          <Link key={item.matchId} href={`/partidos/${item.matchId}`} className="fs-chip hover:border-pitch-accent">
            {item.rival} · {item.rating?.toFixed(1) ?? '—'}{item.contribution != null && item.contribution > 0 ? ` · ${item.contribution} G+A` : ''}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PlayerAdvancedAnalytics({ analytics }: { analytics: Analytics }) {
  if (analytics.season == null || analytics.appearances === 0) {
    return (
      <section className="fs-panel p-6">
        <p className="fs-eyebrow">Jugador 2.0</p>
        <h2 className="mt-2 text-2xl font-bold">Analítica avanzada</h2>
        <p className="mt-2 text-sm text-pitch-muted">Todavía no hay suficientes partidos finalizados para construir percentiles de temporada.</p>
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-labelledby="advanced-player-title">
      <div className="fs-panel p-6 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="fs-eyebrow">Jugador 2.0 · datos de temporada</p>
            <h2 id="advanced-player-title" className="mt-2 text-2xl font-bold sm:text-3xl">Analítica avanzada</h2>
            <p className="mt-2 text-sm text-pitch-muted">
              {analytics.season.competition} · temporada {analytics.season.year} · comparación con {POSITION_LABEL[analytics.positionGroup]} con al menos {analytics.cohortMinimumMinutes} minutos.
            </p>
          </div>
          <span className="fs-chip">Muestra: {analytics.cohortSize} jugadores</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Summary label="Minutos" value={analytics.minutes.toLocaleString('es-ES')} />
          <Summary label="Partidos" value={String(analytics.appearances)} />
          <Summary label="Titularidades" value={String(analytics.starts)} />
          <Summary label="Valoración media" value={analytics.avgRating?.toFixed(2) ?? '—'} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <div className="fs-panel p-5 sm:p-6">
          <h3 className="font-display text-xl font-bold">Percentiles posicionales</h3>
          <p className="mt-1 text-xs text-pitch-muted">P90 significa estar por encima de aproximadamente el 90% de la muestra en esa métrica.</p>
          <div className="mt-5 space-y-4">
            {analytics.metrics.map((metric) => (
              <div key={metric.key}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="text-pitch-muted">{metric.label}</span>
                  <span className="font-semibold text-white">{metric.displayValue} · {metric.percentile == null ? 'P—' : `P${metric.percentile}`}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-pitch-elevated">
                  <div className="h-full rounded-full bg-pitch-accent transition-[width]" style={{ width: `${metric.percentile ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="fs-panel p-5 sm:p-6">
          <h3 className="font-display text-xl font-bold">Radar de rendimiento</h3>
          <p className="mt-1 text-xs text-pitch-muted">Escala 0–100 basada en percentiles de jugadores de la misma demarcación.</p>
          <Radar metrics={analytics.metrics} />
        </div>
      </div>

      <div className="fs-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold">Evolución reciente</h3>
            <p className="mt-1 text-xs text-pitch-muted">Valoración del proveedor en hasta los últimos 10 partidos jugados.</p>
          </div>
          <span className="fs-chip">Forma</span>
        </div>
        <div className="mt-4">
          <Evolution form={analytics.form} />
        </div>
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-pitch-border bg-pitch-bg/45 p-4 text-center">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-pitch-muted">{label}</p>
    </div>
  );
}
