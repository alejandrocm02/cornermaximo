import type { PositionGroup } from '@futstats/db';
import Link from 'next/link';
import { prisma } from '@futstats/db';
import { getPlayerAdvancedAnalytics, type PlayerAdvancedAnalytics } from '@/lib/playerAdvanced';

type PlayerEntry = {
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  position: PositionGroup;
  analytics: PlayerAdvancedAnalytics;
};

const POSITION_LABEL: Record<PositionGroup, string> = {
  GK: 'Portero',
  DF: 'Defensa',
  MF: 'Centrocampista',
  FW: 'Delantero',
};

export async function AdvancedComparison({ p1, p2 }: { p1?: string; p2?: string }) {
  if (p1 == null || p2 == null || p1 === p2) return null;
  if (!/^[a-z0-9-]{1,100}$/i.test(p1) || !/^[a-z0-9-]{1,100}$/i.test(p2)) return null;

  const players = await prisma.player.findMany({
    where: { slug: { in: [p1, p2] } },
    select: {
      id: true,
      slug: true,
      fullName: true,
      knownAs: true,
      photoUrl: true,
      currentTeam: { select: { name: true } },
      positions: { where: { isPrimary: true }, select: { group: true }, take: 1 },
    },
  });
  if (players.length !== 2) return null;

  const ordered = [p1, p2].map((slug) => players.find((player) => player.slug === slug)!);
  if (ordered.some((player) => player.positions[0]?.group == null)) return null;

  const analytics = await Promise.all(
    ordered.map((player) => getPlayerAdvancedAnalytics(player.id, player.positions[0]!.group)),
  );

  const entries: PlayerEntry[] = ordered.map((player, index) => ({
    slug: player.slug,
    name: player.knownAs ?? player.fullName,
    photoUrl: player.photoUrl,
    team: player.currentTeam?.name ?? null,
    position: player.positions[0]!.group,
    analytics: analytics[index]!,
  }));

  if (entries.every((entry) => entry.analytics.season == null)) return null;

  const samePosition = entries[0]!.position === entries[1]!.position;
  const firstMetrics = new Map(entries[0]!.analytics.metrics.map((metric) => [metric.key, metric]));
  const common = entries[1]!.analytics.metrics
    .filter((metric) => firstMetrics.has(metric.key))
    .map((metric) => ({ left: firstMetrics.get(metric.key)!, right: metric }))
    .filter(({ left, right }) => left.percentile != null && right.percentile != null);

  return (
    <section className="space-y-5" aria-labelledby="advanced-comparison-title">
      <div className="fs-panel p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="fs-eyebrow">Comparador 2.0</p>
            <h2 id="advanced-comparison-title" className="mt-2 text-2xl font-bold sm:text-3xl">Perfil de temporada</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-pitch-muted">
              Además de la ventana de partidos de arriba, esta vista compara producción por 90 y percentiles posicionales de temporada. Los percentiles se calculan dentro de la cohorte propia de cada jugador.
            </p>
          </div>
          <Link href="/scouting" className="fs-btn-ghost inline-flex">Buscar otro perfil</Link>
        </div>
        {!samePosition && (
          <p className="mt-4 rounded-lg border border-yellow-600/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
            Los jugadores ocupan posiciones diferentes. Sus percentiles pertenecen a cohortes distintas, por lo que deben interpretarse como perfil relativo y no como una comparación absoluta.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {entries.map((entry) => (
          <article key={entry.slug} className="fs-panel p-5 sm:p-6">
            <div className="flex items-center gap-3">
              {entry.photoUrl != null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.photoUrl} alt="" width={60} height={60} className="h-[60px] w-[60px] rounded-full object-cover" />
              ) : <span className="h-[60px] w-[60px] rounded-full bg-pitch-border" />}
              <div className="min-w-0 flex-1">
                <Link href={`/jugadores/${entry.slug}`} className="text-lg font-bold hover:text-pitch-accent">{entry.name}</Link>
                <p className="text-xs text-pitch-muted">{entry.team ?? 'Sin equipo'} · {POSITION_LABEL[entry.position]}</p>
                <p className="text-xs text-pitch-muted">
                  {entry.analytics.season?.competition ?? 'Sin temporada'} · {entry.analytics.minutes.toLocaleString('es-ES')} min
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Summary label="Partidos" value={String(entry.analytics.appearances)} />
              <Summary label="Titular" value={String(entry.analytics.starts)} />
              <Summary label="Rating" value={entry.analytics.avgRating?.toFixed(2) ?? '—'} />
            </div>

            <div className="mt-5 space-y-3">
              {entry.analytics.metrics.map((metric) => (
                <div key={metric.key}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="text-pitch-muted">{metric.label}</span>
                    <span className="font-semibold">{metric.displayValue} · {metric.percentile == null ? 'P—' : `P${metric.percentile}`}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-pitch-elevated">
                    <div className="h-full rounded-full bg-pitch-accent" style={{ width: `${metric.percentile ?? 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      {common.length >= 2 && (
        <div className="fs-panel overflow-hidden">
          <div className="border-b border-pitch-border px-5 py-4">
            <h3 className="font-display text-lg font-bold">Cara a cara por percentil</h3>
            <p className="mt-1 text-xs text-pitch-muted">Solo métricas presentes en ambos perfiles.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-xs uppercase text-pitch-muted">
                <tr>
                  <th className="px-5 py-3 text-left">Métrica</th>
                  <th className="px-5 py-3 text-center">{entries[0]!.name}</th>
                  <th className="px-5 py-3 text-center">{entries[1]!.name}</th>
                </tr>
              </thead>
              <tbody>
                {common.map(({ left, right }) => {
                  const leftWins = (left.percentile ?? 0) > (right.percentile ?? 0);
                  const rightWins = (right.percentile ?? 0) > (left.percentile ?? 0);
                  return (
                    <tr key={left.key} className="border-t border-pitch-border/60">
                      <th className="px-5 py-3 text-left font-normal text-pitch-muted">{left.label}</th>
                      <td className={`px-5 py-3 text-center font-semibold ${leftWins ? 'text-pitch-accent' : ''}`}>{left.displayValue} · P{left.percentile}</td>
                      <td className={`px-5 py-3 text-center font-semibold ${rightWins ? 'text-pitch-accent' : ''}`}>{right.displayValue} · P{right.percentile}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-pitch-border bg-pitch-bg/40 p-3">
      <p className="font-bold">{value}</p>
      <p className="text-[10px] text-pitch-muted">{label}</p>
    </div>
  );
}
