import { prisma } from '@futstats/db';
import { WORLD_CUP_2026 } from '@futstats/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { groupLabel, seasonLabel } from '@/lib/football';

export const dynamic = 'force-dynamic';

const GROUP_ORDER = ['GK', 'DF', 'MF', 'FW'] as const;
const GROUP_ES: Record<string, string> = {
  GK: 'Porteros',
  DF: 'Defensas',
  MF: 'Centrocampistas',
  FW: 'Delanteros',
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
        : `${team.isNational ? 'Selección' : 'Club'} ${team.name}: plantilla, clasificación, actualidad y estadísticas en FutStats.`,
    alternates: { canonical: `/equipos/${slug}` },
  };
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

  // Una ficha puede estar vinculada a varias competiciones y temporadas. La
  // referencia principal se escoge por vigencia, por tipo adecuado al equipo
  // (liga para clubes, copa para selecciones), por disponibilidad de tabla y,
  // finalmente, por el año más reciente. Así una fila antigua actualizada tarde
  // no sustituye a la clasificación de la temporada vigente.
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

  // En una selección, currentTeamId apunta al club del jugador. La lista se
  // reconstruye desde las actas, pero exclusivamente dentro de la temporada de
  // referencia elegida arriba; nunca se mezclan torneos o ciclos anteriores.
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
  const roster: RosterRow[] =
    team.isNational && contextSeason != null
      ? await prisma.$queryRawUnsafe<RosterRow[]>(
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
      : [];

  const injured = team.players.filter((player) => player.status === 'INJURED' || player.status === 'DOUBT');

  const [teamNews, altas, bajas] = team.isNational
    ? [[], [], []]
    : await Promise.all([
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
            type: true,
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
            type: true,
            player: { select: { slug: true } },
          },
        }),
      ]);

  return (
    <div className="space-y-8">
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
            loading="lazy"
            decoding="async"
            src={team.crestUrl}
            alt=""
            className="h-20 w-20 object-contain"
          />
        ) : (
          <span className="h-20 w-20 rounded-full bg-pitch-border" />
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
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Altas confirmadas</h2>
            <ul className="space-y-2 text-sm">
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
                    desde {transfer.fromName ?? '—'} · {transfer.fee ?? 'No revelado'} ·{' '}
                    {transfer.date.toLocaleDateString('es-ES')}
                  </span>
                </li>
              ))}
              {altas.length === 0 && <li className="text-xs text-pitch-muted">Sin altas registradas recientemente.</li>}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Bajas confirmadas</h2>
            <ul className="space-y-2 text-sm">
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
                    hacia {transfer.toName ?? '—'} · {transfer.fee ?? 'No revelado'} ·{' '}
                    {transfer.date.toLocaleDateString('es-ES')}
                  </span>
                </li>
              ))}
              {bajas.length === 0 && <li className="text-xs text-pitch-muted">Sin bajas registradas recientemente.</li>}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Noticias del club</h2>
            <ul className="space-y-2 text-sm">
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
            </ul>
          </div>
        </section>
      )}

      {team.isNational ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-pitch-muted">
              Convocatoria en actas{contextLabel != null ? ` — ${contextLabel}` : ''} ({roster.length} jugadores)
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
                <h3 className="mb-2 text-xs font-semibold uppercase text-pitch-muted">{GROUP_ES[group]}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {players.map((row) => (
                    <Link
                      key={row.slug}
                      href={`/jugadores/${row.slug}`}
                      className="flex items-center gap-3 rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 text-sm hover:border-pitch-accent"
                    >
                      {row.photoUrl != null ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          width={32}
                          height={32}
                          loading="lazy"
                          decoding="async"
                          src={row.photoUrl}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="h-8 w-8 shrink-0 rounded-full bg-pitch-border" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{row.name}</span>
                        <span className="block truncate text-xs text-pitch-muted">{row.club ?? 'Club no registrado'}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-pitch-muted">
                        <span className="block">
                          {Number(row.played)} PJ · {Number(row.minutes)}&apos;
                        </span>
                        {row.goals != null && Number(row.goals) > 0 && (
                          <span className="block font-semibold text-pitch-accent">{Number(row.goals)} goles</span>
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}

          {roster.some((row) => row.position == null) && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-pitch-muted">Sin posición registrada</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {roster
                  .filter((row) => row.position == null)
                  .map((row) => (
                    <Link
                      key={row.slug}
                      href={`/jugadores/${row.slug}`}
                      className="flex items-center gap-3 rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 text-sm hover:border-pitch-accent"
                    >
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      <span className="shrink-0 text-xs text-pitch-muted">
                        {Number(row.played)} PJ · {Number(row.minutes)}&apos;
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {roster.length === 0 && (
            <p className="text-sm text-pitch-muted">
              {contextSeason == null
                ? 'No hay una temporada asociada a esta selección todavía.'
                : 'Las actas de esta temporada todavía no contienen jugadores. La lista se completará automáticamente durante la sincronización.'}
            </p>
          )}
        </section>
      ) : (
        <section className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pitch-muted">Plantilla actual</h2>
          {GROUP_ORDER.map((group) => {
            const players = team.players.filter((player) => player.positions[0]?.group === group);
            if (players.length === 0) return null;
            return (
              <div key={group}>
                <h3 className="mb-2 text-xs font-semibold uppercase text-pitch-muted">{GROUP_ES[group]}</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {players.map((player) => (
                    <Link
                      key={player.id}
                      href={`/jugadores/${player.slug}`}
                      className="flex items-center gap-3 rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 text-sm hover:border-pitch-accent"
                    >
                      <span className="w-6 text-right text-xs text-pitch-muted">{player.shirtNumber ?? ''}</span>
                      <span className="flex-1 truncate">{player.knownAs ?? player.fullName}</span>
                      {player.status !== 'AVAILABLE' && <span className="text-xs text-pitch-danger">●</span>}
                    </Link>
                  ))}
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
