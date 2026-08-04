import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { TrendBadge } from '@/components/TrendBadge';
import { roundLabel } from '@/lib/football';
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

const POSITION_LABEL: Record<string, string> = {
  GK: 'Portero',
  DF: 'Defensa',
  MF: 'Centrocampista',
  FW: 'Delantero',
};

const TREND_LABEL: Record<string, string> = {
  goalContributions: 'Goles + asistencias',
  keyPasses: 'Pases clave',
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
  saves: 'Paradas',
  goalsConceded: 'Goles encajados',
  cleanSheets: 'Porterías a cero',
  shotsOnTargetFaced: 'Tiros recibidos',
  penaltiesSaved: 'Penaltis parados',
};

function calculateAge(birthDate: string | null): number | null {
  if (birthDate == null) return null;

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayPassed =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());

  if (!birthdayPassed) age -= 1;
  return age >= 0 ? age : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const player = await getPlayerProfileCore(slug);
  if (player == null) return { title: 'Jugador' };

  const name = player.knownAs ?? player.fullName;
  return {
    title: `${name}: estadísticas y últimos partidos`,
    description: `Rendimiento de ${name}${player.currentTeam != null ? ` (${player.currentTeam.name})` : ''}: goles, asistencias, minutos y tendencia en sus últimos partidos.`,
    alternates: { canonical: `/jugadores/${slug}` },
    openGraph: {
      title: `${name} | FutStats`,
      ...(player.photoUrl != null ? { images: [player.photoUrl] } : {}),
    },
  };
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ desde?: string }>;
}) {
  const { slug } = await params;
  const { desde } = await searchParams;
  const backHref = desde != null && /^[\w=&%.+-]*$/.test(desde) ? `/jugadores?${desde}` : '/jugadores';

  const player = await getPlayerProfileCore(slug);
  if (player == null) notFound();

  const isGoalkeeper = player.positions.some(
    (position) => position.isPrimary && position.group === 'GK',
  );
  const [data, content] = await Promise.all([
    getLastMatches(player.id, isGoalkeeper),
    getPlayerProfileContent(player.id, player.currentTeamId),
  ]);

  const age = calculateAge(player.birthDate);
  const primaryPosition = player.positions.find((position) => position.isPrimary)?.group ?? null;
  const fmt = (value: number | null | undefined) => (value == null ? '—' : String(value));
  const mainMetrics = isGoalkeeper
    ? (['saves', 'goalsConceded', 'cleanSheets', 'shotsOnTargetFaced', 'penaltiesSaved'] as const)
    : (['goals', 'assists', 'goalContributions', 'shotsOnTarget', 'keyPasses', 'duelsWon'] as const);

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: player.knownAs ?? player.fullName,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/jugadores/${player.slug}`,
    ...(player.photoUrl != null ? { image: player.photoUrl } : {}),
    ...(player.currentTeam != null
      ? { affiliation: { '@type': 'SportsTeam', name: player.currentTeam.name } }
      : {}),
    ...(player.nationality != null ? { nationality: player.nationality.name } : {}),
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <Breadcrumbs
        items={[
          { label: 'Jugadores', href: backHref },
          { label: player.knownAs ?? player.fullName },
        ]}
      />

      <section className="flex flex-wrap items-center gap-5 rounded-2xl border border-pitch-border bg-pitch-card p-6">
        {player.photoUrl != null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            width={96}
            height={96}
            loading="lazy"
            decoding="async"
            src={player.photoUrl}
            alt=""
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <span className="h-24 w-24 rounded-full bg-pitch-border" />
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold sm:text-4xl">
            {player.knownAs ?? player.fullName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-pitch-muted">
            <span>
              {primaryPosition != null
                ? POSITION_LABEL[primaryPosition] ?? primaryPosition
                : 'Posición sin registrar'}
            </span>
            {player.currentTeam != null && (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  href={`/equipos/${player.currentTeam.slug}`}
                  className="inline-flex items-center gap-1.5 text-pitch-accent hover:underline"
                >
                  {player.currentTeam.crestUrl != null && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      width={18}
                      height={18}
                      src={player.currentTeam.crestUrl}
                      alt=""
                      className="h-[18px] w-[18px] object-contain"
                    />
                  )}
                  {player.currentTeam.name}
                </Link>
              </>
            )}
            {player.shirtNumber != null && (
              <>
                <span aria-hidden="true">·</span>
                <span>#{player.shirtNumber}</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-pitch-muted">
            {[
              player.nationality?.name,
              age != null ? `${age} años` : null,
              player.heightCm != null ? `${player.heightCm} cm` : null,
            ]
              .filter((value): value is string => value != null && value !== '')
              .join(' · ')}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              player.status === 'AVAILABLE'
                ? 'bg-pitch-accent/15 text-pitch-accent'
                : 'bg-pitch-danger/15 text-pitch-danger'
            }`}
          >
            {STATUS_LABEL[player.status] ?? player.status}
          </span>
          <Link
            href={`/comparador?p1=${player.slug}`}
            className="rounded-lg bg-pitch-accent px-4 py-2 text-sm font-semibold text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-pitch-accent"
          >
            Comparar con otro jugador
          </Link>
        </div>
      </section>

      {Object.keys(data.trends).length > 0 && (
        <section aria-label="Tendencias recientes" className="flex flex-wrap gap-2">
          {Object.entries(data.trends).map(([key, trend]) => (
            <TrendBadge
              key={key}
              direction={trend.direction}
              label={TREND_LABEL[key] ?? key}
            />
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
          Resumen — últimos {data.matches.length} partidos jugados
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Minutos" value={String(data.summary.minutes)} />
          <Stat label="Valoración media" value={fmt(data.summary.avgRating)} />
          {mainMetrics.map((metric) => (
            <Stat
              key={metric}
              label={METRIC_ES[metric] ?? metric}
              value={fmt(data.summary.metrics[metric]?.total)}
              sub={
                data.summary.metrics[metric]?.per90 != null
                  ? `${data.summary.metrics[metric]!.per90}/90'`
                  : undefined
              }
            />
          ))}
          {isGoalkeeper && data.summary.rates.savePercentage != null && (
            <Stat label="% paradas" value={`${data.summary.rates.savePercentage}%`} />
          )}
          {!isGoalkeeper && data.summary.rates.passAccuracy != null && (
            <Stat label="% pase" value={`${data.summary.rates.passAccuracy}%`} />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
          Partido a partido
        </h2>
        <div className="space-y-2">
          {data.matches.map((match) => {
            const translatedRound = roundLabel(match.round);
            return (
              <article
                key={match.matchId}
                className="fs-panel flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm"
              >
                <time dateTime={match.date} className="w-20 text-xs text-pitch-muted">
                  {new Date(match.date).toLocaleDateString('es-ES')}
                </time>
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    {match.isHome ? 'vs' : '@'} {match.rival}{' '}
                    <span className="text-pitch-muted">({match.result})</span>
                  </p>
                  <p className="truncate text-xs text-pitch-muted">
                    {match.competition}
                    {translatedRound != null ? ` · ${translatedRound}` : ''}
                  </p>
                </div>
                <span className="text-xs text-pitch-muted">
                  {match.minutes}&apos; · {match.role === 'STARTER' ? 'Titular' : 'Suplente'}
                </span>
                {isGoalkeeper ? (
                  <span className="text-xs">
                    🧤 {match.saves ?? '—'} paradas · {match.goalsConceded ?? '—'} encajados
                  </span>
                ) : (
                  <span className="text-xs">
                    ⚽ {match.goals ?? 0} · 🎯 {match.assists ?? 0}
                  </span>
                )}
                {match.rating != null && (
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      match.rating >= 7
                        ? 'bg-pitch-accent/15 text-pitch-accent'
                        : match.rating < 6
                          ? 'bg-pitch-danger/15 text-pitch-danger'
                          : 'bg-slate-500/15 text-slate-300'
                    }`}
                  >
                    {match.rating.toFixed(1)}
                  </span>
                )}
              </article>
            );
          })}
          {data.matches.length === 0 && (
            <p className="rounded-xl border border-dashed border-pitch-border p-6 text-center text-sm text-pitch-muted">
              Este jugador aún no tiene partidos con estadísticas sincronizadas.
            </p>
          )}
        </div>

        {data.benchOnly.length > 0 && (
          <p className="mt-3 text-xs text-pitch-muted">
            Convocado sin minutos en {data.benchOnly.length} partido(s) de este periodo; no
            cuentan en la ventana de rendimiento.
          </p>
        )}
      </section>

      {(content.news.length > 0 || content.transfers.length > 0) && (
        <section className="grid gap-6 lg:grid-cols-2">
          {content.news.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
                Últimas noticias
              </h2>
              <ul className="space-y-2 text-sm">
                {content.news.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2"
                  >
                    <a
                      href={item.url}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="hover:text-pitch-accent"
                    >
                      {item.title}
                    </a>
                    <span className="mt-0.5 block text-xs text-pitch-muted">
                      {item.source} · {new Date(item.publishedAt).toLocaleDateString('es-ES')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content.transfers.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
                Mercado
              </h2>
              <ul className="space-y-2 text-sm">
                {content.transfers.map((transfer) => (
                  <li
                    key={transfer.id}
                    className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2"
                  >
                    <span className="mr-2 rounded-full bg-pitch-accent/15 px-2 py-0.5 text-xs font-medium text-pitch-accent">
                      ✓ Confirmado
                    </span>
                    {transfer.fromName ?? '—'} → {transfer.toName ?? '—'}
                    <span className="mt-0.5 block text-xs text-pitch-muted">
                      {new Date(transfer.date).toLocaleDateString('es-ES')} ·{' '}
                      {transfer.fee ?? 'No revelado'} · Fuente: API-Football
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="fs-panel p-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-pitch-muted">{label}</p>
      {sub != null && <p className="text-[10px] text-pitch-muted">{sub}</p>}
    </div>
  );
}
