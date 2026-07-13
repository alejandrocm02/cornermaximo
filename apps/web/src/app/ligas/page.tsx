import { prisma } from '@futstats/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ligas' };

export default async function LeaguesPage() {
  const leagues = await prisma.competition.findMany({
    include: { country: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ligas</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {leagues.map((l) => (
          <Link
            key={l.id}
            href={`/ligas/${l.slug}`}
            className="rounded-xl border border-pitch-border bg-pitch-card p-5 hover:border-pitch-accent"
          >
            <p className="font-semibold">{l.name}</p>
            <p className="text-sm text-pitch-muted">{l.country.name}</p>
          </Link>
        ))}
        {leagues.length === 0 && (
          <p className="col-span-3 text-sm text-pitch-muted">Sin ligas sincronizadas todavía.</p>
        )}
      </div>
    </div>
  );
}
