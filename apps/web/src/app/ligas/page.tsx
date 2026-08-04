import { prisma } from '@futstats/db';
import Link from 'next/link';
import { seasonLabel } from '@/lib/football';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Ligas',
  description:
    'Explora las ligas disponibles en FutStats con clasificación, calendario, equipos y temporadas correctamente contextualizadas.',
  alternates: { canonical: '/ligas' },
};

function apiFootballLeagueLogo(externalId: string): string {
  return `https://media.api-sports.io/football/leagues/${encodeURIComponent(externalId)}.png`;
}

export default async function LeaguesPage() {
  const leagues = await prisma.competition.findMany({
    where: { type: 'LEAGUE' },
    include: {
      country: { select: { name: true } },
      seasons: {
        orderBy: { year: 'desc' },
        select: { id: true, year: true, isCurrent: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const countries = new Set(leagues.map((league) => league.country.name)).size;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="fs-eyebrow">Competiciones nacionales</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Ligas</h1>
        <p className="max-w-2xl text-sm text-pitch-muted">
          Consulta clasificaciones, jornadas, próximos partidos y equipos de todas las ligas sincronizadas.
          Cada competición conserva su formato real de temporada.
        </p>
        {leagues.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-pitch-muted">
            <span className="fs-chip">{leagues.length} ligas</span>
            <span className="fs-chip">{countries} países</span>
          </div>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {leagues.map((league) => {
          const currentSeason =
            league.seasons.find((season) => season.isCurrent) ?? league.seasons[0];
          const logoUrl = league.logoUrl ?? apiFootballLeagueLogo(league.externalId);

          return (
            <Link
              key={league.id}
              href={`/ligas/${league.slug}`}
              className="fs-panel-interactive group flex min-h-40 flex-col justify-between p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 pt-1">
                    <p className="truncate font-display text-lg font-semibold text-white">{league.name}</p>
                    <p className="mt-1 text-sm text-pitch-muted">{league.country.name}</p>
                  </div>
                  <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/95 p-2 shadow-sm transition-transform duration-200 group-hover:scale-105">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt={`Logo de ${league.name}`}
                      width={52}
                      height={52}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                    />
                  </span>
                </div>

                {currentSeason != null && (
                  <p className="mt-4 text-xs text-pitch-subtle">
                    <span className="text-pitch-muted">
                      {currentSeason.isCurrent ? 'Temporada actual' : 'Última disponible'}:{' '}
                    </span>
                    {seasonLabel(currentSeason.year, league.seasonFormat)}
                  </p>
                )}
              </div>

              <p className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-pitch-accent">
                Abrir competición
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
              </p>
            </Link>
          );
        })}

        {leagues.length === 0 && (
          <p className="col-span-full fs-panel px-4 py-8 text-center text-sm text-pitch-muted">
            Sin ligas sincronizadas todavía.
          </p>
        )}
      </div>
    </div>
  );
}
