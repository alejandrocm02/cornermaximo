import { prisma } from '@cornermaximo/db';
import { FavoriteButton } from '@/components/FavoriteButton';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default async function TeamProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      shortName: true,
      crestUrl: true,
      founded: true,
      isNational: true,
      country: { select: { name: true } },
      stadium: { select: { name: true, city: true } },
      coach: { select: { name: true } },
    },
  });

  const jsonLd = team == null
    ? null
    : {
        '@context': 'https://schema.org',
        '@type': 'SportsTeam',
        name: team.name,
        ...(team.shortName != null ? { alternateName: team.shortName } : {}),
        url: `${BASE_URL}/equipos/${team.slug}`,
        sport: 'Football',
        ...(team.crestUrl != null ? { logo: team.crestUrl, image: team.crestUrl } : {}),
        ...(team.founded != null ? { foundingDate: String(team.founded) } : {}),
        ...(team.coach != null ? { coach: { '@type': 'Person', name: team.coach.name } } : {}),
        ...(team.stadium != null
          ? {
              location: {
                '@type': 'Place',
                name: team.stadium.name,
                ...(team.stadium.city != null ? { address: team.stadium.city } : {}),
              },
            }
          : {}),
        description: `${team.isNational ? 'Selección nacional' : 'Club de fútbol'} de ${team.country.name}.`,
      };

  return (
    <div className="space-y-3">
      {jsonLd != null && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      {team != null && (
        <div className="flex justify-end">
          <FavoriteButton
            item={{
              kind: 'team',
              slug: team.slug,
              name: team.name,
              imageUrl: team.crestUrl,
              subtitle: team.isNational ? `Selección de ${team.country.name}` : team.country.name,
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
