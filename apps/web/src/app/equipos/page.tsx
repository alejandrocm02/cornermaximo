import { prisma } from '@futstats/db';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { TeamsDirectory, type TeamDirectoryItem } from './TeamsDirectory';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: { absolute: 'Equipos | CornerMaximo Sports Intelligence' },
  description: 'Explora clubes y selecciones en CornerMaximo. Busca por nombre, país o competición y accede a plantillas, resultados y estadísticas.',
  alternates: { canonical: '/equipos' },
};

export default async function TeamsPage() {
  const rows = await prisma.team.findMany({
    where: { seasons: { some: { season: { isCurrent: true } } } },
    select: {
      slug: true, name: true, shortName: true, crestUrl: true, isNational: true,
      country: { select: { name: true } }, _count: { select: { players: true } },
      seasons: { where: { season: { isCurrent: true } }, select: { season: { select: { competition: { select: { name: true, slug: true } } } } }, orderBy: { season: { competition: { name: 'asc' } } } },
    }, orderBy: [{ isNational: 'desc' }, { name: 'asc' }],
  });
  const teams: TeamDirectoryItem[] = rows.map((team) => ({ slug: team.slug, name: team.name, shortName: team.shortName, crestUrl: team.crestUrl, isNational: team.isNational, country: team.country?.name ?? null, playerCount: team._count.players, competitions: team.seasons.map((entry) => entry.season.competition) }));
  return <div className="space-y-6"><Breadcrumbs items={[{ label: 'Equipos' }]}/><header className="fs-panel relative overflow-hidden p-6 sm:p-8"><div aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-pitch-accent/10 blur-3xl"/><div className="relative max-w-3xl"><p className="fs-eyebrow">CORNERMAXIMO · TEAMS</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Equipos</h1><p className="mt-3 text-sm leading-6 text-pitch-muted sm:text-base">Clubes y selecciones conectados con sus jugadores, competiciones, partidos y datos de rendimiento.</p></div></header><TeamsDirectory teams={teams}/></div>;
}
