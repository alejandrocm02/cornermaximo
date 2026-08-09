import type { AdvancedMetric } from '@/lib/playerAdvancedStats';

function point(index: number, total: number, radius: number, value = 100) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / total;
  const scaled = radius * (value / 100);
  return `${100 + Math.cos(angle) * scaled},${100 + Math.sin(angle) * scaled}`;
}

export function PlayerPerformanceRadar({ metrics }: { metrics: AdvancedMetric[] }) {
  const available = metrics.filter((metric) => metric.percentile != null);
  if (available.length < 3) {
    return (
      <div className="fs-panel p-5 text-sm text-pitch-muted">
        Aún no hay suficientes métricas comparables para construir un radar fiable.
      </div>
    );
  }

  const polygon = available.map((metric, index) => point(index, available.length, 72, metric.percentile ?? 0)).join(' ');
  const outer = available.map((_, index) => point(index, available.length, 72)).join(' ');
  const mid = available.map((_, index) => point(index, available.length, 72, 50)).join(' ');

  return (
    <div className="fs-panel p-5 sm:p-6">
      <div className="mx-auto max-w-md">
        <svg viewBox="0 0 200 200" role="img" aria-label="Radar de percentiles de rendimiento" className="h-auto w-full">
          <polygon points={outer} fill="none" stroke="currentColor" className="text-pitch-border" strokeWidth="1" />
          <polygon points={mid} fill="none" stroke="currentColor" className="text-pitch-border" strokeWidth="1" />
          {available.map((_, index) => (
            <line key={index} x1="100" y1="100" x2={point(index, available.length, 72).split(',')[0]} y2={point(index, available.length, 72).split(',')[1]} stroke="currentColor" className="text-pitch-border" strokeWidth="1" />
          ))}
          <polygon points={polygon} fill="currentColor" stroke="currentColor" className="text-pitch-accent" fillOpacity="0.2" strokeWidth="2" />
          {available.map((metric, index) => {
            const [x, y] = point(index, available.length, 88).split(',');
            return (
              <text key={metric.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-pitch-muted text-[7px]">
                {metric.label}
              </text>
            );
          })}
        </svg>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {available.map((metric) => (
          <div key={metric.key} className="rounded-xl border border-pitch-border bg-pitch-bg/40 px-3 py-2 text-center">
            <p className="font-display text-lg font-bold text-white">P{metric.percentile}</p>
            <p className="text-[11px] text-pitch-muted">{metric.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
