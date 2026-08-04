import { prisma } from '@futstats/db';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { TeamsDirectory, type TeamDirectoryItem } from './TeamsDirectory';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: 'Equipos de fútbol, plantillas y estadísticas | FutStats' },
  description:
    'Explora los clubes y selecciones disponibles en FutStats. Busca por nombre, país o competición y consulta sus plantillas, resultados y estadísticas.',
  alternates: { canonical: '/equipos' },
};

export default async function TeamsPage() {
  const rows = await prisma.team.findMany({
    where: { seasons: { some: {} } },
    select: {
      slug: true,
      name: true,
      shortName: true,
      crestUrl: true,
      isNational: true,
      country: { select: { name: true } },
      _count: { select: { players: true } },
      seasons: {
        select: {
          season: {
            select: {
              year: true,
              isCurrent: true,
              competition: { select: { slug: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const teams: TeamDirectoryItem[] = rows.map((team) => {
    const seen = new Set<string>();
    const competitions = [...team.seasons]
      .sort(
        (a, b) =>
          Number(b.season.isCurrent) - Number(a.season.isCurrent) ||
          b.season.year - a.season.year,
      )
      .map(({ season }) => season.competition)
      .filter((competition) => {
        if (seen.has(competition.slug)) return false;
        seen.add(competition.slug);
        return true;
      });

    return {
      slug: team.slug,
      name: team.name,
      shortName: team.shortName,
      crestUrl: team.crestUrl,
      country: team.country.name,
      isNational: team.isNational,
      playerCount: team._count.players,
      competitions,
    };
  });

  const competitionCount = new Set(
    teams.flatMap((team) => team.competitions.map((competition) => competition.slug)),
  ).size;
  const countryCount = new Set(teams.map((team) => team.country)).size;

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Equipos' }]} />

      <section className="relative isolate overflow-hidden rounded-4xl border border-pitch-border/70 px-5 py-8 sm:px-8 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-grad-brand opacity-[0.08]"
        />
        <p className="fs-eyebrow">
          <span aria-hidden="true" className="h-1 w-5 rounded-full bg-grad-brand" />
          Directorio FutStats
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Equipos y selecciones</h1>
        <p className="mt-3 max-w-3xl text-sm text-pitch-muted sm:text-base">
          Encuentra clubes y selecciones por nombre, país o competición y accede a sus
          plantillas, clasificación, partidos, noticias y movimientos de mercado.
        </p>

        <dl className="mt-6 grid max-w-2xl grid-cols-3 gap-3">
          <div className="rounded-2xl border border-pitch-border bg-pitch-card/70 p-3">
            <dt className="text-2xs uppercase tracking-wide text-pitch-muted">Equipos</dt>
            <dd className="mt-1 font-display text-xl font-bold text-white">{teams.length}</dd>
          </div>
          <div className="rounded-2xl border border-pitch-border bg-pitch-card/70 p-3">
            <dt className="text-2xs uppercase tracking-wide text-pitch-muted">Países</dt>
            <dd className="mt-1 font-display text-xl font-bold text-white">{countryCount}</dd>
          </div>
          <div className="rounded-2xl border border-pitch-border bg-pitch-card/70 p-3">
            <dt className="text-2xs uppercase tracking-wide text-pitch-muted">Competiciones</dt>
            <dd className="mt-1 font-display text-xl font-bold text-white">{competitionCount}</dd>
          </div>
        </dl>
      </section>

      <TeamsDirectory teams={teams} />
    </div>
  );
}
