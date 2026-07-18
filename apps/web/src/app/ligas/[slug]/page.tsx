import { prisma } from '@futstats/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { formatMatchDate } from '@/lib/football';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export const dynamic = 'force-dynamic';

/** Nº de jornadas iniciales que se muestran en la página de la liga. */
const FIRST_ROUNDS_SHOWN = 5;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await prisma.competition.findUnique({ where: { slug } });
  return { title: c?.name ?? 'Liga' };
}

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ temporada?: string }>;
}) {
  const { slug } = await params;
  const { temporada } = await searchParams;

  const competition = await prisma.competition.findUnique({
    where: { slug },
    include: { seasons: { orderBy: { year: 'asc' }, select: { id: true, year: true, isCurrent: true } } },
  });
  if (competition == null) notFound();
  // El Mundial 2026 tiene su propia sección (grupos, eliminatorias, goleadores).
  if (competition.type === 'CUP') redirect('/mundial-2026');

  const availableSeasons = competition.seasons;
  const requestedYear = temporada != null ? Number(temporada) : undefined;
  const seasonMeta =
    availableSeasons.find((s) => s.year === requestedYear) ??
    availableSeasons.find((s) => s.isCurrent) ??
    availableSeasons[availableSeasons.length - 1];

  // API-Football nombra las jornadas de liga "Regular Season - N".
  const firstRounds = Array.from({ length: FIRST_ROUNDS_SHOWN }, (_, i) => `Regular Season - ${i + 1}`);

  const [season, roundMatches] = await Promise.all([
    seasonMeta != null
      ? prisma.season.findUnique({
          where: { id: seasonMeta.id },
          include: {
            standings: {
              include: { team: { select: { name: true, slug: true, crestUrl: true } } },
              orderBy: { position: 'asc' },
            },
            matches: {
              where: { status: 'SCHEDULED', kickoffAt: { gte: new Date() } },
              include: { teams: { include: { team: { select: { name: true } } } } },
              orderBy: { kickoffAt: 'asc' },
              take: 5,
            },
          },
        })
      : null,
    seasonMeta != null
      ? prisma.match.findMany({
          where: { seasonId: seasonMeta.id, round: { in: firstRounds } },
          include: { teams: { include: { team: { select: { name: true, slug: true } } } } },
          orderBy: { kickoffAt: 'asc' },
        })
      : [],
  ]);

  // Agrupar por jornada preservando el orden 1..N
  const jornadas = firstRounds
    .map((round, i) => ({
      num: i + 1,
      matches: roundMatches.filter((m) => m.round === round),
    }))
    .filter((j) => j.matches.length > 0);

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Ligas', href: '/ligas' }, { label: competition.name }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {competition.name} {season != null && <span className="text-pitch-muted">· {season.year}-{(season.year + 1) % 100}</span>}
        </h1>
        {availableSeasons.length > 1 && (
          <div className="flex gap-2 text-sm">
            {availableSeasons.map((s) => (
              <Link
                key={s.id}
                href={`/ligas/${slug}?temporada=${s.year}`}
                className={`rounded-lg border px-3 py-1.5 ${
                  s.id === seasonMeta?.id
                    ? 'border-pitch-accent text-pitch-accent'
                    : 'border-pitch-border text-pitch-muted hover:text-white'
                }`}
              >
                {s.year}-{(s.year + 1) % 100}
              </Link>
            ))}
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Clasificación</h2>
        {season != null && season.standings.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-pitch-border">
            <table className="w-full min-w-[560px] bg-pitch-card text-sm">
              <thead className="text-left text-xs uppercase text-pitch-muted">
                <tr className="border-b border-pitch-border">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Equipo</th>
                  <th className="px-3 py-2 text-right">PJ</th>
                  <th className="px-3 py-2 text-right">G</th>
                  <th className="px-3 py-2 text-right">E</th>
                  <th className="px-3 py-2 text-right">P</th>
                  <th className="px-3 py-2 text-right">GF</th>
                  <th className="px-3 py-2 text-right">GC</th>
                  <th className="px-3 py-2 text-right">Pts</th>
                  <th className="px-3 py-2">Forma</th>
                </tr>
              </thead>
              <tbody>
                {season.standings.map((row) => (
                  <tr key={row.id} className="border-b border-pitch-border/50 last:border-0">
                    <td className="px-3 py-2 text-pitch-muted">{row.position}</td>
                    <td className="px-3 py-2">
                      <Link href={`/equipos/${row.team.slug}`} className="hover:text-pitch-accent">
                        {row.team.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">{row.played}</td>
                    <td className="px-3 py-2 text-right">{row.won}</td>
                    <td className="px-3 py-2 text-right">{row.drawn}</td>
                    <td className="px-3 py-2 text-right">{row.lost}</td>
                    <td className="px-3 py-2 text-right">{row.goalsFor}</td>
                    <td className="px-3 py-2 text-right">{row.goalsAgainst}</td>
                    <td className="px-3 py-2 text-right font-semibold">{row.points}</td>
                    <td className="px-3 py-2 text-xs tracking-widest text-pitch-muted">{row.form ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-pitch-muted">
            Clasificación aún no sincronizada para esta temporada (se actualiza automáticamente cada pocas horas).
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
          Primeras {FIRST_ROUNDS_SHOWN} jornadas
        </h2>
        {jornadas.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {jornadas.map((j) => (
              <div key={j.num} className="rounded-xl border border-pitch-border bg-pitch-card">
                <p className="border-b border-pitch-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-pitch-muted">
                  Jornada {j.num}
                </p>
                <ul className="divide-y divide-pitch-border/50">
                  {j.matches.map((m) => {
                    const home = m.teams.find((t) => t.isHome);
                    const away = m.teams.find((t) => !t.isHome);
                    const played = m.status === 'FINISHED';
                    return (
                      <li key={m.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-right">
                          <Link href={`/equipos/${home?.team.slug}`} className="hover:text-pitch-accent">
                            {home?.team.name}
                          </Link>
                        </span>
                        <span
                          className={`w-14 shrink-0 rounded px-1 text-center font-semibold ${
                            played ? 'bg-pitch-accent/10 text-pitch-accent' : 'text-pitch-muted'
                          }`}
                          title={played ? 'Finalizado' : formatMatchDate(m.kickoffAt)}
                        >
                          {played ? `${home?.goals ?? '-'}–${away?.goals ?? '-'}` : formatMatchDate(m.kickoffAt).slice(0, 6)}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          <Link href={`/equipos/${away?.team.slug}`} className="hover:text-pitch-accent">
                            {away?.team.name}
                          </Link>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-pitch-muted">
            El calendario de esta temporada aún no está sincronizado.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Próximos partidos</h2>
        <div className="space-y-2">
          {season?.matches.map((m) => {
            const home = m.teams.find((t) => t.isHome);
            const away = m.teams.find((t) => !t.isHome);
            return (
              <div key={m.id} className="flex items-center gap-4 rounded-xl border border-pitch-border bg-pitch-card px-4 py-3 text-sm">
                <span className="w-32 text-xs text-pitch-muted">{formatMatchDate(m.kickoffAt)}</span>
                <span>{home?.team.name} — {away?.team.name}</span>
              </div>
            );
          })}
          {(season == null || season.matches.length === 0) && (
            <p className="text-sm text-pitch-muted">Sin partidos programados en la base de datos.</p>
          )}
        </div>
      </section>
    </div>
  );
}
