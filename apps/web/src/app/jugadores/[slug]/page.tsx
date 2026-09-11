import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { TrendBadge } from '@/components/TrendBadge';
import { PlayerMatchHistory } from '@/components/PlayerMatchHistory';
import { parseHistoryFilters, type HistorySearchParams } from '@/lib/matchHistory';
import { getHistoryOptions, getPlayerMatchHistory } from '@/lib/playerMatchHistory';
import { getPlayerProfileContent, getPlayerProfileCore } from '@/lib/playerProfile';
import { getLastMatches } from '@/lib/recent';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  INJURED: 'Lesionado',
  SUSPENDED: 'Sancionado',
  DOUBT: 'Duda',
  NOT_CALLED: 'No convocado',
};
const POSITION_LABEL: Record<string, string> = { GK: 'Portero', DF: 'Defensa', MF: 'Centrocampista', FW: 'Delantero' };
const TREND_LABEL: Record<string, string> = {
  goalContributions: 'Goles + asistencias',
  keyPasses: 'Pases clave',
  tackles: 'Entradas',
  foulsCommitted: 'Faltas cometidas',
  saves: 'Paradas',
  goalsConceded: 'Goles encajados',
};
const METRIC_ES: Record<string, string> = {
  goals: 'Goles',
  assists: 'Asistencias',
  goalContributions: 'G+A',
  shotsOnTarget: 'Tiros a puerta',
  keyPasses: 'Pases clave',
  duelsWon: 'Duelos ganados',
  tackles: 'Entradas',
  foulsCommitted: 'Faltas cometidas',
  foulsDrawn: 'Faltas recibidas',
  interceptions: 'Intercepciones',
  saves: 'Paradas',
  goalsConceded: 'Goles encajados',
  cleanSheets: 'Porterías a cero',
  shotsOnTargetFaced: 'Tiros recibidos',
  penaltiesSaved: 'Penaltis parados',
};

function calculateAge(value: string | null) {
  if (!value) return null;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age--;
  return age >= 0 ? age : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const player = await getPlayerProfileCore(slug);
  if (!player) return { title: 'Jugador | CornerMaximo' };
  const name = player.knownAs ?? player.fullName;
  return {
    title: `${name}: estadísticas y rendimiento | CornerMaximo`,
    description: `Rendimiento de ${name}${player.currentTeam ? ` (${player.currentTeam.name})` : ''}: métricas, forma y últimos partidos.`,
    alternates: { canonical: `/jugadores/${slug}` },
    openGraph: { title: `${name} | CornerMaximo`, ...(player.photoUrl ? { images: [player.photoUrl] } : {}) },
  };
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<HistorySearchParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const desde = typeof query.desde === 'string' ? query.desde : undefined;
  const historyFilters = parseHistoryFilters(query);
  const backHref = desde && /^[\w=&%.+-]*$/.test(desde) ? `/jugadores?${desde}` : '/jugadores';
  const player = await getPlayerProfileCore(slug);
  if (!player) notFound();

  const isGK = player.positions.some((p) => p.isPrimary && p.group === 'GK');
  const [data, seasonData, content, history, historyOptions] = await Promise.all([
    getLastMatches(player.id, isGK),
    getLastMatches(player.id, isGK, 'season'),
    getPlayerProfileContent(player.id, player.currentTeamId),
    getPlayerMatchHistory(player.id, historyFilters),
    getHistoryOptions(player.id),
  ]);
  const age = calculateAge(player.birthDate);
  const pos = player.positions.find((p) => p.isPrimary)?.group ?? null;
  const fmt = (value: number | null | undefined) => (value == null ? '—' : String(value));
  const recentMetrics = isGK
    ? (['saves', 'goalsConceded', 'cleanSheets', 'shotsOnTargetFaced', 'penaltiesSaved'] as const)
    : (['goals', 'assists', 'goalContributions', 'shotsOnTarget', 'keyPasses', 'duelsWon'] as const);
  const defensiveMetrics = ['tackles', 'foulsCommitted', 'foulsDrawn', 'interceptions'] as const;
  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: player.knownAs ?? player.fullName,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/jugadores/${player.slug}`,
    ...(player.photoUrl ? { image: player.photoUrl } : {}),
    ...(player.currentTeam ? { affiliation: { '@type': 'SportsTeam', name: player.currentTeam.name } } : {}),
    ...(player.nationality ? { nationality: player.nationality.name } : {}),
  };

  return (
    <div className="min-w-0 space-y-8">
      <JsonLd data={personJsonLd} />
      <Breadcrumbs items={[{ label: 'Jugadores', href: backHref }, { label: player.knownAs ?? player.fullName }]} />

      <section className="fs-panel relative overflow-hidden p-6">
        <div aria-hidden="true" className="absolute right-0 top-0 h-48 w-64 bg-pitch-accent/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          {player.photoUrl ? (
            <Image width={104} height={104} src={player.photoUrl} alt="" fetchPriority="high" className="h-24 w-24 rounded-2xl object-cover ring-1 ring-pitch-border sm:h-28 sm:w-28" />
          ) : (
            <span className="h-24 w-24 rounded-2xl bg-pitch-elevated" />
          )}
          <div className="min-w-0 flex-1">
            <p className="fs-eyebrow">CORNERMAXIMO · PLAYER INTELLIGENCE</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{player.knownAs ?? player.fullName}</h1>
            <p className="mt-2 flex flex-wrap gap-x-2 text-sm text-pitch-muted">
              <span>{pos ? POSITION_LABEL[pos] ?? pos : 'Posición sin registrar'}</span>
              {player.currentTeam && <><span>·</span><Link href={`/equipos/${player.currentTeam.slug}`} className="text-pitch-accent hover:underline">{player.currentTeam.name}</Link></>}
              {player.shirtNumber != null && <span>· #{player.shirtNumber}</span>}
            </p>
            <p className="mt-1 text-xs text-pitch-muted">{[player.nationality?.name, age != null ? `${age} años` : null, player.heightCm ? `${player.heightCm} cm` : null].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="flex flex-col gap-2">
            <span className={`fs-chip justify-center ${player.status === 'AVAILABLE' ? 'text-pitch-accent' : 'text-pitch-danger'}`}>{STATUS_LABEL[player.status] ?? player.status}</span>
            <Link href={`/comparador?p1=${player.slug}`} className="fs-btn-primary">CM Compare</Link>
          </div>
        </div>
      </section>

      {Object.keys(data.trends).length > 0 && (
        <section aria-label="Tendencias recientes" className="flex flex-wrap gap-2">
          {Object.entries(data.trends).map(([key, trend]) => <TrendBadge key={key} direction={trend.direction} label={TREND_LABEL[key] ?? key} />)}
        </section>
      )}

      <section className="fs-panel p-5 sm:p-6">
        <div className="mb-4">
          <p className="fs-eyebrow">PERFORMANCE</p>
          <h2 className="mt-1 text-xl font-bold">Forma reciente</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Minutos" value={String(data.summary.minutes)} />
          <Stat label="Rating" value={fmt(data.summary.avgRating)} />
          {recentMetrics.map((metric) => <Stat key={metric} label={METRIC_ES[metric] ?? metric} value={fmt(data.summary.metrics[metric]?.total)} sub={data.summary.metrics[metric]?.per90 != null ? `${data.summary.metrics[metric]!.per90}/90'` : undefined} />)}
        </div>

        {!isGK && (
          <div className="mt-6 border-t border-pitch-border/60 pt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="fs-eyebrow">INTENSIDAD · TEMPORADA ACTUAL</p>
                <h2 className="mt-1 text-xl font-bold">Entradas y faltas</h2>
              </div>
              <p className="text-xs text-pitch-muted">{seasonData.summary.matches} partidos · {seasonData.summary.minutes} min</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {defensiveMetrics.map((metric) => <Stat key={metric} label={METRIC_ES[metric] ?? metric} value={fmt(seasonData.summary.metrics[metric]?.total)} sub={seasonData.summary.metrics[metric]?.per90 != null ? `${seasonData.summary.metrics[metric]!.per90}/90'` : undefined} />)}
            </div>
          </div>
        )}
      </section>

      <PlayerMatchHistory
        slug={player.slug}
        playerName={player.knownAs ?? player.fullName}
        isGoalkeeper={isGK}
        matches={history}
        filters={historyFilters}
        options={historyOptions}
        from={desde && /^[\w=&%.+-]*$/.test(desde) ? desde : undefined}
      />

      {(content.news.length > 0 || content.transfers.length > 0) && (
        <section className="grid gap-6 lg:grid-cols-2">
          {content.news.length > 0 && <div><h2 className="mb-3 font-semibold">Últimas noticias</h2>{content.news.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="fs-panel mb-2 block p-3 text-sm hover:text-pitch-accent">{item.title}<span className="mt-1 block text-xs text-pitch-muted">{item.source}</span></a>)}</div>}
          {content.transfers.length > 0 && <div><h2 className="mb-3 font-semibold">Mercado</h2>{content.transfers.map((transfer) => <div key={transfer.id} className="fs-panel mb-2 p-3 text-sm"><span className="text-pitch-accent">Confirmado · </span>{transfer.fromName ?? '—'} → {transfer.toName ?? '—'}</div>)}</div>}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="fs-panel p-3"><p className="font-display text-2xl font-bold tabular-nums text-white">{value}</p><p className="mt-1 text-2xs uppercase tracking-wide text-pitch-muted">{label}</p>{sub && <p className="mt-1 text-xs tabular-nums text-pitch-accent">{sub}</p>}</div>;
}
