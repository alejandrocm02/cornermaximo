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

  const injured = team.players.filter((p) => p.status === 'INJURED' || p.status === 'DOUBT');

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
          <img src={team.crestUrl} alt="" className="h-20 w-20 object-contain" />
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
    </div>
  );
}
