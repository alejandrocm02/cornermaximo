import { prisma } from '@futstats/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ligas' };

export default async function LeaguesPage() {
  const competitions = await prisma.competition.findMany({
    include: { country: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  const leagues = competitions.filter((competition) => competition.type === 'LEAGUE');
  const cups = competitions.filter((competition) => competition.type === 'CUP');

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Ligas</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/ligas/${league.slug}`}
              className="rounded-lg border border-pitch-border bg-pitch-card p-5 hover:border-pitch-accent"
            >
              <p className="font-semibold">{league.name}</p>
              <p className="text-sm text-pitch-muted">{league.country.name}</p>
            </Link>
          ))}
          {leagues.length === 0 && (
            <p className="col-span-3 text-sm text-pitch-muted">Sin ligas sincronizadas todavia.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Copas y torneos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cups.map((cup) => (
            <Link
              key={cup.id}
              href={cup.slug === 'mundial-2026' ? '/mundial-2026' : `/ligas/${cup.slug}`}
              className="rounded-lg border border-pitch-border bg-pitch-card p-5 hover:border-pitch-accent"
            >
              <p className="font-semibold">{cup.name}</p>
              <p className="text-sm text-pitch-muted">{cup.country.name}</p>
            </Link>
          ))}
          {cups.length === 0 && (
            <Link href="/mundial-2026" className="rounded-lg border border-dashed border-pitch-border p-5 text-sm text-pitch-muted hover:border-pitch-accent">
              Mundial 2026 preparado para sincronizar.
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
