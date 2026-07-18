import { prisma } from '@futstats/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export const dynamic = 'force-dynamic';

const GROUP_ORDER = ['GK', 'DF', 'MF', 'FW'] as const;
const GROUP_ES: Record<string, string> = { GK: 'Porteros', DF: 'Defensas', MF: 'Centrocampistas', FW: 'Delanteros' };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await prisma.team.findUnique({ where: { slug } });
  return { title: t?.name ?? 'Equipo' };
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    include: {
      country: { select: { name: true } },
      stadium: true,
      coach: true,
      players: { include: { positions: { where: { isPrimary: true } } }, orderBy: { shirtNumber: 'asc' } },
      standings: { include: { season: { include: { competition: true } } }, orderBy: { updatedAt: 'desc' }, take: 1 },
    },
  });
  if (team == null) notFound();
  const standing = team.standings[0];

  // Selecciones: `currentTeamId` de un jugador apunta a su CLUB, así que la
  // convocatoria real se reconstruye desde las actas de los partidos del torneo
  // (titulares, suplentes y convocados sin minutos), con sus números agregados.
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
  const roster: RosterRow[] = team.isNational
    ? await prisma.$queryRawUnsafe<RosterRow[]>(
        `
        SELECT p.slug,
               COALESCE(p."knownAs", p."fullName") AS name,
               p."photoUrl" AS "photoUrl",
               (SELECT pp."group"::text FROM "PlayerPosition" pp WHERE pp."playerId" = p.id AND pp."isPrimary" LIMIT 1) AS position,
               ct.name AS club,
               COUNT(*) FILTER (WHERE mp."minutesPlayed" > 0)::bigint AS played,
               COALESCE(SUM(mp."minutesPlayed"), 0)::bigint AS minutes,
               SUM(s.goals)::bigint AS goals
        FROM "MatchPlayer" mp
        JOIN "Player" p ON p.id = mp."playerId"
        LEFT JOIN "Team" ct ON ct.id = p."currentTeamId" AND ct.id <> mp."teamId"
        LEFT JOIN "PlayerMatchStatistics" s ON s."matchPlayerId" = mp.id
        WHERE mp."teamId" = $1
        GROUP BY p.id, p.slug, p."knownAs", p."fullName", p."photoUrl", ct.name
        ORDER BY minutes DESC
        `,
        team.id,
      )
    : [];

  const injured = team.players.filter((p) => p.status === 'INJURED' || p.status === 'DOUBT');

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
          select: { id: true, playerName: true, fromName: true, fee: true, date: true, type: true, player: { select: { slug: true } } },
        }),
        prisma.transfer.findMany({
          where: { fromTeamId: team.id },
          orderBy: { date: 'desc' },
          take: 5,
          select: { id: true, playerName: true, toName: true, fee: true, date: true, type: true, player: { select: { slug: true } } },
        }),
      ]);

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          ...(standing != null
            ? [
                standing.season.competition.type === 'CUP'
                  ? { label: 'Mundial 2026', href: '/mundial-2026' }
                  : { label: standing.season.competition.name, href: `/ligas/${standing.season.competition.slug}` },
              ]
            : [{ label: 'Ligas', href: '/ligas' }]),
          { label: team.name },
        ]}
      />
      <section className="flex flex-wrap items-center gap-5 rounded-2xl border border-pitch-border bg-pitch-card p-6">
        {team.crestUrl != null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img width={80} height={80} loading="lazy" decoding="async" src={team.crestUrl} alt="" className="h-20 w-20 object-contain" />
        ) : (
          <span className="h-20 w-20 rounded-full bg-pitch-border" />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
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
          {standing != null && (
            <p className="mt-1 text-sm">
              <Link href={`/${standing.season.competition.type === 'CUP' ? 'mundial-2026' : `ligas/${standing.season.competition.slug}`}`} className="text-pitch-accent hover:underline">
                {standing.season.competition.name}
              </Link>{' '}
              {standing.group != null && `— ${standing.group}`} — {standing.position}º con {standing.points} pts
            </p>
          )}
        </div>
      </section>

      {injured.length > 0 && (
        <section className="rounded-xl border border-pitch-danger/40 bg-pitch-danger/5 p-4 text-sm">
          <span className="font-semibold text-pitch-danger">Bajas y dudas: </span>
          {injured.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <Link href={`/jugadores/${p.slug}`} className="hover:underline">
                {p.knownAs ?? p.fullName}
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
              {altas.map((t) => (
                <li key={t.id} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
                  {t.player != null ? <Link href={`/jugadores/${t.player.slug}`} className="font-medium hover:text-pitch-accent">{t.playerName}</Link> : <span className="font-medium">{t.playerName}</span>}
                  <span className="block text-xs text-pitch-muted">desde {t.fromName ?? '—'} · {t.fee ?? 'No revelado'} · {t.date.toLocaleDateString('es-ES')}</span>
                </li>
              ))}
              {altas.length === 0 && <li className="text-xs text-pitch-muted">Sin altas registradas desde junio de 2025.</li>}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Bajas confirmadas</h2>
            <ul className="space-y-2 text-sm">
              {bajas.map((t) => (
                <li key={t.id} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
                  {t.player != null ? <Link href={`/jugadores/${t.player.slug}`} className="font-medium hover:text-pitch-accent">{t.playerName}</Link> : <span className="font-medium">{t.playerName}</span>}
                  <span className="block text-xs text-pitch-muted">hacia {t.toName ?? '—'} · {t.fee ?? 'No revelado'} · {t.date.toLocaleDateString('es-ES')}</span>
                </li>
              ))}
              {bajas.length === 0 && <li className="text-xs text-pitch-muted">Sin bajas registradas desde junio de 2025.</li>}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Noticias del club</h2>
            <ul className="space-y-2 text-sm">
              {teamNews.map((n) => (
                <li key={n.id} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
                  <a href={n.url} rel="noopener noreferrer" target="_blank" className="hover:text-pitch-accent">{n.title}</a>
                  <span className="block text-xs text-pitch-muted">{n.source} · {n.publishedAt.toLocaleDateString('es-ES')}</span>
                </li>
              ))}
              {teamNews.length === 0 && <li className="text-xs text-pitch-muted">Sin noticias vinculadas todavía.</li>}
            </ul>
          </div>
        </section>
      )}

      {team.isNational ? (
        <section className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pitch-muted">
            Convocatoria — Mundial 2026 ({roster.length} jugadores)
          </h2>
          <p className="-mt-4 text-xs text-pitch-muted">
            Construida a partir de las actas de los partidos del torneo. PJ = partidos con minutos.
          </p>
          {GROUP_ORDER.map((group) => {
            const players = roster.filter((r) => r.position === group);
            if (players.length === 0) return null;
            return (
              <div key={group}>
                <h3 className="mb-2 text-xs font-semibold uppercase text-pitch-muted">{GROUP_ES[group]}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {players.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/jugadores/${r.slug}`}
                      className="flex items-center gap-3 rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 text-sm hover:border-pitch-accent"
                    >
                      {r.photoUrl != null ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img width={32} height={32} loading="lazy" decoding="async" src={r.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="h-8 w-8 shrink-0 rounded-full bg-pitch-border" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{r.name}</span>
                        <span className="block truncate text-xs text-pitch-muted">{r.club ?? '—'}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-pitch-muted">
                        <span className="block">{Number(r.played)} PJ · {Number(r.minutes)}&apos;</span>
                        {r.goals != null && Number(r.goals) > 0 && (
                          <span className="block font-semibold text-pitch-accent">{Number(r.goals)} goles</span>
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
          {roster.filter((r) => r.position == null).length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-pitch-muted">Sin posición registrada</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {roster.filter((r) => r.position == null).map((r) => (
                  <Link key={r.slug} href={`/jugadores/${r.slug}`} className="flex items-center gap-3 rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 text-sm hover:border-pitch-accent">
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="shrink-0 text-xs text-pitch-muted">{Number(r.played)} PJ · {Number(r.minutes)}&apos;</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {roster.length === 0 && (
            <p className="text-sm text-pitch-muted">
              La convocatoria todavía no está disponible: se completará automáticamente al sincronizar
              las actas de los partidos.
            </p>
          )}
        </section>
      ) : (
      <section className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-pitch-muted">Plantilla</h2>
        {GROUP_ORDER.map((group) => {
          const players = team.players.filter((p) => p.positions[0]?.group === group);
          if (players.length === 0) return null;
          return (
            <div key={group}>
              <h3 className="mb-2 text-xs font-semibold uppercase text-pitch-muted">{GROUP_ES[group]}</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {players.map((p) => (
                  <Link
                    key={p.id}
                    href={`/jugadores/${p.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 text-sm hover:border-pitch-accent"
                  >
                    <span className="w-6 text-right text-xs text-pitch-muted">{p.shirtNumber ?? ''}</span>
                    <span className="flex-1 truncate">{p.knownAs ?? p.fullName}</span>
                    {p.status !== 'AVAILABLE' && <span className="text-xs text-pitch-danger">●</span>}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
        {team.players.length === 0 && (
          <p className="text-sm text-pitch-muted">Plantilla aún no sincronizada.</p>
        )}
      </section>
      )}
    </div>
  );
}
