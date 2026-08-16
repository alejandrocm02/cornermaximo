import { prisma } from '@cornermaximo/db';
import { WORLD_CUP_2026 } from '@cornermaximo/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { TeamInsightsPanel } from '@/components/CompetitionInsightPanels';
import { getTeamInsights } from '@/lib/competitionInsights';
import { groupLabel, seasonLabel } from '@/lib/football';

export const dynamic = 'force-dynamic';

const GROUP_ORDER = ['GK', 'DF', 'MF', 'FW'] as const;
const GROUP_ES: Record<string, string> = {
  GK: 'Porteros',
  DF: 'Defensas',
  MF: 'Centrocampistas',
  FW: 'Delanteros',
};
const PLAYER_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  INJURED: 'Lesionado',
  SUSPENDED: 'Sancionado',
  DOUBT: 'Duda',
  NOT_CALLED: 'No convocado',
};

function competitionHref(competition: { slug: string; type: string }): string | undefined {
  if (competition.slug === WORLD_CUP_2026.slug) return '/mundial-2026';
  if (competition.type === 'LEAGUE') return `/ligas/${competition.slug}`;
  return undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    select: { name: true, isNational: true, country: { select: { name: true } } },
  });

  return {
    title: team?.name ?? 'Equipo',
    description:
      team == null
        ? undefined
        : `${team.isNational ? 'Selección' : 'Club'} ${team.name}: plantilla, clasificación, actualidad y estadísticas en CornerMaximo.`,
    alternates: { canonical: `/equipos/${slug}` },
  };
}

interface RosterRow {
  slug: string;
  name: string;
  photoUrl: string | null;
  position: string | null;
  club: string | null;
  played: bigint;
  minutes: bigint;
  goals: bigint | null;
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    include: {
      country: { select: { name: true } },
      stadium: true,
      coach: true,
      players: {
        include: { positions: { where: { isPrimary: true } } },
        orderBy: { shirtNumber: 'asc' },
      },
      seasons: {
        include: { season: { include: { competition: true } } },
      },
      standings: {
        include: { season: { include: { competition: true } } },
      },
    },
  });
  if (team == null) notFound();

  // La temporada principal prioriza vigencia, el tipo adecuado para club o
  // selección, la existencia de clasificación y el año más reciente.
  const seasonCandidates = Array.from(
    new Map([
      ...team.seasons.map(({ season }) => [season.id, season] as const),
      ...team.standings.map(({ season }) => [season.id, season] as const),
    ]).values(),
  );
  const preferredType = team.isNational ? 'CUP' : 'LEAGUE';
  const contextSeason = seasonCandidates
    .slice()
    .sort((a, b) => {
      const score = (season: (typeof seasonCandidates)[number]) =>
        (season.isCurrent ? 100_000 : 0) +
        (season.competition.type === preferredType ? 10_000 : 0) +
        (team.standings.some((row) => row.seasonId === season.id) ? 1_000 : 0) +
        season.year;
      return score(b) - score(a);
    })[0];

  const standing =
    contextSeason == null
      ? undefined
      : team.standings
          .filter((row) => row.seasonId === contextSeason.id)
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const contextCompetition = contextSeason?.competition;
  const contextHref = contextCompetition == null ? undefined : competitionHref(contextCompetition);
  const contextLabel =
    contextSeason == null
      ? null
      : `${contextCompetition!.name} · ${seasonLabel(contextSeason.year, contextCompetition!.seasonFormat)}`;

  // Las tres ramas costosas se ejecutan en paralelo: analítica, convocatoria
  // reconstruida para selecciones y contenido editorial/mercado para clubes.
  const rosterPromise: Promise<RosterRow[]> =
    team.isNational && contextSeason != null
      ? prisma.$queryRawUnsafe<RosterRow[]>(
          `
          SELECT p.slug,
                 COALESCE(p."knownAs", p."fullName") AS name,
                 p."photoUrl" AS "photoUrl",
                 (SELECT pp."group"::text
                    FROM "PlayerPosition" pp
                   WHERE pp."playerId" = p.id AND pp."isPrimary"
                   LIMIT 1) AS position,
                 ct.name AS club,
                 COUNT(DISTINCT mp."matchId") FILTER (WHERE mp."minutesPlayed" > 0)::bigint AS played,
                 COALESCE(SUM(mp."minutesPlayed"), 0)::bigint AS minutes,
                 SUM(s.goals)::bigint AS goals
            FROM "MatchPlayer" mp
            JOIN "Match" m ON m.id = mp."matchId"
            JOIN "Player" p ON p.id = mp."playerId"
       LEFT JOIN "Team" ct ON ct.id = p."currentTeamId" AND ct.id <> mp."teamId"
       LEFT JOIN "PlayerMatchStatistics" s ON s."matchPlayerId" = mp.id
           WHERE mp."teamId" = $1
             AND m."seasonId" = $2
        GROUP BY p.id, p.slug, p."knownAs", p."fullName", p."photoUrl", ct.name
        ORDER BY minutes DESC, name ASC
          `,
          team.id,
          contextSeason.id,
        )
      : Promise.resolve([]);

  const insightsPromise =
    contextSeason == null ? Promise.resolve(null) : getTeamInsights(team.id, contextSeason.id);

  const marketPromise = team.isNational
    ? Promise.resolve([[], [], []] as const)
    : Promise.all([
        prisma.newsItem.findMany({
          where: { teamId: team.id },
          orderBy: { publishedAt: 'desc' },
          take: 3,
          select: { id: true, title: true, url: true, source: true, publishedAt: true },
        }),
        prisma.transfer.findMany({
          where: { toTeamId: team.id },
          orderBy: { date: 'desc' },
          take: 5,
          select: {
            id: true,
            playerName: true,
            fromName: true,
            fee: true,
            date: true,
            player: { select: { slug: true } },
          },
        }),
        prisma.transfer.findMany({
          where: { fromTeamId: team.id },
          orderBy: { date: 'desc' },
          take: 5,
          select: {
            id: true,
            playerName: true,
            toName: true,
            fee: true,
            date: true,
            player: { select: { slug: true } },
          },
        }),
      ]);

  const [roster, insights, [teamNews, altas, bajas]] = await Promise.all([
    rosterPromise,
    insightsPromise,
    marketPromise,
  ]);

  const injured = team.players.filter((player) => player.status === 'INJURED' || player.status === 'DOUBT');

  return (
    <div className="space-y-10">
      <Breadcrumbs
        items={[
          { label: 'Equipos', href: '/equipos' },
          ...(contextCompetition != null
            ? [{ label: contextCompetition.name, ...(contextHref != null ? { href: contextHref } : {}) }]
            : []),
          { label: team.name },
        ]}
      />

      <section className="flex flex-wrap items-center gap-5 rounded-2xl border border-pitch-border bg-pitch-card p-6">
        {team.crestUrl != null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            width={80}
            height={80}
            src={team.crestUrl}
            alt=""
            className="h-20 w-20 object-contain"
          />
        ) : (
          <span aria-hidden="true" className="h-20 w-20 rounded-full bg-pitch-border" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold sm:text-4xl">
            {team.name}
            {team.isNational && (
              <span className="ml-2 rounded-full bg-pitch-accent/15 px-2 py-0.5 align-middle text-xs font-medium text-pitch-accent">
                Selección nacional
              </span>
            )}
          </h1>
          <p className="text-sm text-pitch-muted">
            {team.country.name}
            {team.stadium != null && ` · ${team.stadium.name}`}
            {team.coach != null && ` · DT: ${team.coach.name}`}
          </p>

          {contextSeason != null && contextCompetition != null && (
            <p className="mt-2 text-sm text-pitch-subtle">
              <span className="text-pitch-muted">
                {contextSeason.isCurrent ? 'Temporada actual' : 'Última temporada disponible'}:{' '}
              </span>
              {contextHref != null ? (
                <Link href={contextHref} className="text-pitch-accent hover:underline">
                  {contextCompetition.name}
                </Link>
              ) : (
                <span className="text-white">{contextCompetition.name}</span>
              )}{' '}
              · {seasonLabel(contextSeason.year, contextCompetition.seasonFormat)}
              {standing != null && (
                <>
                  {' — '}
                  {standing.group != null && `${groupLabel(standing.group)} · `}
                  {standing.position}º con {standing.points} pts
                </>
              )}
            </p>
          )}
        </div>
      </section>

      {insights != null && <TeamInsightsPanel insights={insights} />}

      {injured.length > 0 && (
        <section className="rounded-xl border border-pitch-danger/40 bg-pitch-danger/5 p-4 text-sm">
          <span className="font-semibold text-pitch-danger">Bajas y dudas: </span>
          {injured.map((player, index) => (
            <span key={player.id}>
              {index > 0 && ', '}
              <Link href={`/jugadores/${player.slug}`} className="hover:underline">
                {player.knownAs ?? player.fullName}
              </Link>
            </span>
          ))}
        </section>
      )}

      {!team.isNational && (altas.length > 0 || bajas.length > 0 || teamNews.length > 0) && (
        <section className="grid gap-6 lg:grid-cols-3" aria-label="Mercado y actualidad del club">
          <TransferColumn title="Altas confirmadas">
            {altas.map((transfer) => (
              <li key={transfer.id} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
                {transfer.player != null ? (
                  <Link href={`/jugadores/${transfer.player.slug}`} className="font-medium hover:text-pitch-accent">
                    {transfer.playerName}
                  </Link>
                ) : (
                  <span className="font-medium">{transfer.playerName}</span>
                )}
                <span className="block text-xs text-pitch-muted">
                  desde {transfer.fromName ?? '—'} · {transfer.fee ?? 'No revelado'} · {transfer.date.toLocaleDateString('es-ES')}
                </span>
              </li>
            ))}
            {altas.length === 0 && <li className="text-xs text-pitch-muted">Sin altas registradas recientemente.</li>}
          </TransferColumn>

          <TransferColumn title="Bajas confirmadas">
            {bajas.map((transfer) => (
              <li key={transfer.id} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
                {transfer.player != null ? (
                  <Link href={`/jugadores/${transfer.player.slug}`} className="font-medium hover:text-pitch-accent">
                    {transfer.playerName}
                  </Link>
                ) : (
                  <span className="font-medium">{transfer.playerName}</span>
                )}
                <span className="block text-xs text-pitch-muted">
                  hacia {transfer.toName ?? '—'} · {transfer.fee ?? 'No revelado'} · {transfer.date.toLocaleDateString('es-ES')}
                </span>
              </li>
            ))}
            {bajas.length === 0 && <li className="text-xs text-pitch-muted">Sin bajas registradas recientemente.</li>}
          </TransferColumn>

          <TransferColumn title="Noticias del club">
            {teamNews.map((news) => (
              <li key={news.id} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
                <a href={news.url} rel="noopener noreferrer" target="_blank" className="hover:text-pitch-accent">
                  {news.title}
                </a>
                <span className="block text-xs text-pitch-muted">
                  {news.source} · {news.publishedAt.toLocaleDateString('es-ES')}
                </span>
              </li>
            ))}
            {teamNews.length === 0 && <li className="text-xs text-pitch-muted">Sin noticias vinculadas todavía.</li>}
          </TransferColumn>
        </section>
      )}

      {team.isNational ? (
        <NationalRoster roster={roster} contextLabel={contextLabel} hasSeason={contextSeason != null} />
      ) : (
        <section className="space-y-6">
          <div>
            <p className="fs-eyebrow">Jugadores registrados</p>
            <h2 className="mt-1 text-2xl font-bold">Plantilla por posición</h2>
          </div>
          {GROUP_ORDER.map((group) => {
            const players = team.players.filter((player) => player.positions[0]?.group === group);
            if (players.length === 0) return null;
            return (
              <div key={group}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-pitch-muted">{GROUP_ES[group]}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {players.map((player) => {
                    const position = player.positions[0];
                    const available = player.status === 'AVAILABLE';
                    return (
                      <Link
                        key={player.id}
                        href={`/jugadores/${player.slug}`}
                        className="fs-panel-interactive flex items-center gap-3 p-3"
                      >
                        {player.photoUrl != null ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            width={44}
                            height={44}
                            src={player.photoUrl}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-pitch-border"
                          />
                        ) : (
                          <span aria-hidden="true" className="h-11 w-11 shrink-0 rounded-full bg-pitch-elevated ring-1 ring-pitch-border" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">
                            {player.knownAs ?? player.fullName}
                          </span>
                          <span className="block truncate text-2xs text-pitch-muted">
                            {player.shirtNumber != null ? `#${player.shirtNumber} · ` : ''}
                            {position?.specificPosition ?? (GROUP_ES[group] ?? group).slice(0, -1)}
                          </span>
                        </span>
                        <span
                          title={PLAYER_STATUS_LABEL[player.status] ?? player.status}
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${available ? 'bg-pitch-accent' : 'bg-pitch-danger'}`}
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {team.players.length === 0 && <p className="text-sm text-pitch-muted">Plantilla aún no sincronizada.</p>}
        </section>
      )}
    </div>
  );
}

function TransferColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">{title}</h2>
      <ul className="space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function NationalRoster({
  roster,
  contextLabel,
  hasSeason,
}: {
  roster: RosterRow[];
  contextLabel: string | null;
  hasSeason: boolean;
}) {
  return (
    <section className="space-y-6">
      <div>
        <p className="fs-eyebrow">Convocatorias verificadas</p>
        <h2 className="mt-1 text-2xl font-bold">
          Plantilla por posición{contextLabel != null ? ` · ${contextLabel}` : ''}
        </h2>
        <p className="mt-2 text-xs text-pitch-muted">
          Reconstruida únicamente con las actas de la temporada indicada. PJ = partidos con minutos; también se incluyen convocados sin participación.
        </p>
      </div>

      {GROUP_ORDER.map((group) => {
        const players = roster.filter((row) => row.position === group);
        if (players.length === 0) return null;
        return (
          <div key={group}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-pitch-muted">{GROUP_ES[group]}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((row) => (
                <NationalPlayerCard key={row.slug} row={row} />
              ))}
            </div>
          </div>
        );
      })}

      {roster.some((row) => row.position == null) && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-pitch-muted">Sin posición registrada</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roster
              .filter((row) => row.position == null)
              .map((row) => <NationalPlayerCard key={row.slug} row={row} />)}
          </div>
        </div>
      )}

      {roster.length === 0 && (
        <p className="text-sm text-pitch-muted">
          {!hasSeason
            ? 'No hay una temporada asociada a esta selección todavía.'
            : 'Las actas de esta temporada todavía no contienen jugadores. La lista se completará automáticamente durante la sincronización.'}
        </p>
      )}
    </section>
  );
}

function NationalPlayerCard({ row }: { row: RosterRow }) {
  return (
    <Link href={`/jugadores/${row.slug}`} className="fs-panel-interactive flex items-center gap-3 p-3">
      {row.photoUrl != null ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img width={44} height={44} src={row.photoUrl} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-pitch-border" />
      ) : (
        <span aria-hidden="true" className="h-11 w-11 shrink-0 rounded-full bg-pitch-elevated ring-1 ring-pitch-border" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{row.name}</span>
        <span className="block truncate text-2xs text-pitch-muted">{row.club ?? 'Club no registrado'}</span>
      </span>
      <span className="shrink-0 text-right text-2xs text-pitch-muted">
        <span className="block">{Number(row.played)} PJ · {Number(row.minutes)}&apos;</span>
        {row.goals != null && Number(row.goals) > 0 && (
          <span className="block font-semibold text-pitch-accent">{Number(row.goals)} goles</span>
        )}
      </span>
    </Link>
  );
}
