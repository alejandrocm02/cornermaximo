import { prisma } from '@futstats/db';
import Link from 'next/link';
import { SearchBox } from '@/components/SearchBox';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [leagues, recentMatches] = await Promise.all([
    prisma.competition.findMany({ orderBy: { name: 'asc' } }),
    prisma.match.findMany({
      where: { status: 'FINISHED' },
      include: {
        teams: { include: { team: { select: { name: true, slug: true } } } },
        season: { include: { competition: { select: { name: true } } } },
      },
      orderBy: { kickoffAt: 'desc' },
      take: 6,
    }),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-4 py-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          El rendimiento de cada futbolista, <span className="text-pitch-accent">en sus últimos 5 partidos</span>
        </h1>
        <p className="text-pitch-muted">Las 5 grandes ligas europeas. Datos objetivos, sin humo.</p>
        <div className="flex justify-center">
          <SearchBox />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Ligas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {leagues.length > 0 ? (
            leagues.map((l) => (
              <Link
                key={l.id}
                href={`/ligas/${l.slug}`}
                className="rounded-xl border border-pitch-border bg-pitch-card p-4 text-center text-sm font-medium hover:border-pitch-accent"
              >
                {l.name}
              </Link>
            ))
          ) : (
            <p className="col-span-5 rounded-xl border border-dashed border-pitch-border p-6 text-center text-sm text-pitch-muted">
              Aún no hay datos. Lanza la primera sincronización (ver README).
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Últimos partidos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentMatches.map((m) => {
            const home = m.teams.find((t) => t.isHome);
            const away = m.teams.find((t) => !t.isHome);
            return (
              <div key={m.id} className="rounded-xl border border-pitch-border bg-pitch-card p-4">
                <p className="mb-1 text-xs text-pitch-muted">
                  {m.season.competition.name} · {m.kickoffAt.toLocaleDateString('es-ES')}
                </p>
                <p className="text-sm font-medium">
                  {home?.team.name} <span className="text-pitch-accent">{home?.goals}–{away?.goals}</span>{' '}
                  {away?.team.name}
                </p>
              </div>
            );
          })}
          {recentMatches.length === 0 && (
            <p className="text-sm text-pitch-muted">Sin partidos sincronizados todavía.</p>
          )}
        </div>
      </section>
    </div>
  );
}
