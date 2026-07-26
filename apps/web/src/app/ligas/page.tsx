import { prisma } from '@futstats/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Ligas',
  description: 'Las 5 grandes ligas europeas con clasificación, jornadas y plantillas: LaLiga, Premier League, Serie A, Bundesliga y Ligue 1.',
  alternates: { canonical: '/ligas' },
};

export default async function LeaguesPage() {
  const leagues = await prisma.competition.findMany({
    where: { type: 'LEAGUE' },
    include: { country: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold sm:text-4xl">Ligas</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {leagues.map((l) => (
          <Link
            key={l.id}
            href={`/ligas/${l.slug}`}
            className="fs-panel-interactive p-5"
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
