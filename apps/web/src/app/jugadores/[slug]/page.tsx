import { prisma } from '@futstats/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TrendBadge } from '@/components/TrendBadge';
import { getLastMatches } from '@/lib/recent';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  INJURED: 'Lesionado',
  SUSPENDED: 'Sancionado',
  DOUBT: 'Duda',
  NOT_CALLED: 'No convocado',
};

const TREND_LABEL: Record<string, string> = {
  goalContributions: 'Goles + asistencias',
  keyPasses: 'Pases clave',
  saves: 'Paradas',
  goalsConceded: 'Goles encajados',
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.player.findUnique({ where: { slug } });
  return { title: p != null ? (p.knownAs ?? p.fullName) : 'Jugador' };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = await prisma.player.findUnique({
    where: { slug },
    include: {
      currentTeam: { select: { name: true, slug: true, crestUrl: true } },
      positions: true,
      nationality: { select: { name: true } },
    },
  });
  if (player == null) notFound();

  const isGoalkeeper = player.positions.some((p) => p.isPrimary && p.group === 'GK');
  const data = await getLastMatches(player.id, isGoalkeeper);
  const age =
    player.birthDate != null
      ? Math.floor((Date.now() - player.birthDate.getTime()) / (365.25 * 24 * 3_600_000))
      : null;

  const fmt = (v: number | null | undefined) => (v == null ? '—' : String(v));

  const mainMetrics = isGoalkeeper
    ? (['saves', 'goalsConceded', 'cleanSheets', 'shotsOnTargetFaced', 'penaltiesSaved'] as const)
    : (['goals', 'assists', 'goalContributions', 'shotsOnTarget', 'keyPasses', 'duelsWon'] as const);

  const METRIC_ES: Record<string, string> = {
    goals: 'Goles',
    assists: 'Asistencias',
    goalContributions: 'G+A',
    shotsOnTarget: 'Tiros a puerta',
    keyPasses: 'Pases clave',
    duelsWon: 'Duelos ganados',
    saves: 'Paradas',
    goalsConceded: 'Goles encajados',
    cleanSheets: 'Porterías a cero',
    shotsOnTargetFaced: 'Tiros recibidos',
    penaltiesSaved: 'Penaltis parados',
  };

  return (
    <div className="space-y-8">
      {/* Cabecera */}
      <section className="flex flex-wrap items-center gap-5 rounded-2xl border border-pitch-border bg-pitch-card p-6">
        {player.photoUrl != null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.photoUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <span className="h-24 w-24 rounded-full bg-pitch-border" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{player.knownAs ?? player.fullName}</h1>
          <p className="text-sm text-pitch-muted">
            {player.positions.find((p) => p.isPrimary)?.group ?? '—'}
            {player.currentTeam != null && (
              <>
                {' · '}
                <Link href={`/equipos/${player.currentTeam.slug}`} className="text-pitch-accent hover:underline">
                  {player.currentTeam.name}
                </Link>
              </>
            )}
            {player.shirtNumber != null && ` · #${player.shirtNumber}`}
          </p>
          <p className="mt-1 text-xs text-pitch-muted">
            {player.nationality?.name ?? ''} {age != null ? `· ${age} años` : ''}{' '}
            {player.heightCm != null ? `· ${player.heightCm} cm` : ''}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            player.status === 'AVAILABLE'
              ? 'bg-pitch-accent/15 text-pitch-accent'
              : 'bg-pitch-danger/15 text-pitch-danger'
          }`}
        >
          {STATUS_LABEL[player.status] ?? player.status}
        </span>
      </section>

      {/* Tendencias */}
      <section className="flex flex-wrap gap-2">
        {Object.entries(data.trends).map(([key, t]) => (
          <TrendBadge key={key} direction={t.direction} label={TREND_LABEL[key] ?? key} />
        ))}
      </section>

      {/* Resumen últimos 5 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
          Resumen — últimos {data.matches.length} partidos jugados
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Minutos" value={String(data.summary.minutes)} />
          <Stat label="Valoración media" value={fmt(data.summary.avgRating)} />
          {mainMetrics.map((m) => (
            <Stat key={m} label={METRIC_ES[m] ?? m} value={fmt(data.summary.metrics[m]?.total)} sub={data.summary.metrics[m]?.per90 != null ? `${data.summary.metrics[m]!.per90}/90'` : undefined} />
          ))}
          {isGoalkeeper && data.summary.rates.savePercentage != null && (
            <Stat label="% paradas" value={`${data.summary.rates.savePercentage}%`} />
          )}
          {!isGoalkeeper && data.summary.rates.passAccuracy != null && (
            <Stat label="% pase" value={`${data.summary.rates.passAccuracy}%`} />
          )}
        </div>
      </section>

      {/* Detalle por partido */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Partido a partido</h2>
        <div className="space-y-2">
          {data.matches.map((m) => (
            <div key={m.matchId} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-pitch-border bg-pitch-card px-4 py-3 text-sm">
              <span className="w-20 text-xs text-pitch-muted">{new Date(m.date).toLocaleDateString('es-ES')}</span>
              <span className="min-w-0 flex-1 truncate">
                {m.isHome ? 'vs' : '@'} {m.rival} <span className="text-pitch-muted">({m.result})</span>
              </span>
              <span className="text-xs text-pitch-muted">{m.minutes}&apos; · {m.role === 'STARTER' ? 'Titular' : 'Suplente'}</span>
              {isGoalkeeper ? (
                <span className="text-xs">🧤 {m.saves ?? '—'} paradas · {m.goalsConceded ?? '—'} encajados</span>
              ) : (
                <span className="text-xs">⚽ {m.goals ?? 0} · 🎯 {m.assists ?? 0}</span>
              )}
              {m.rating != null && (
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${m.rating >= 7 ? 'bg-pitch-accent/15 text-pitch-accent' : m.rating < 6 ? 'bg-pitch-danger/15 text-pitch-danger' : 'bg-slate-500/15 text-slate-300'}`}>
                  {m.rating.toFixed(1)}
                </span>
              )}
            </div>
          ))}
          {data.matches.length === 0 && (
            <p className="rounded-xl border border-dashed border-pitch-border p-6 text-center text-sm text-pitch-muted">
              Este jugador aún no tiene partidos con estadísticas sincronizadas.
            </p>
          )}
        </div>

        {data.benchOnly.length > 0 && (
          <p className="mt-3 text-xs text-pitch-muted">
            Convocado sin minutos en {data.benchOnly.length} partido(s) de este periodo (no cuentan en los últimos 5).
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-pitch-border bg-pitch-card p-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-pitch-muted">{label}</p>
      {sub != null && <p className="text-[10px] text-pitch-muted">{sub}</p>}
    </div>
  );
}
