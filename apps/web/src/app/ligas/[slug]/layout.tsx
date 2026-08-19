import { FavoriteButton } from '@/components/FavoriteButton';
import { JsonLd } from '@/components/JsonLd';
import { getFavoriteCompetitionIdentity } from '@/lib/favoriteEntities';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default async function CompetitionProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getFavoriteCompetitionIdentity(slug);
  const imageUrl = competition == null
    ? null
    : competition.logoUrl ?? `https://media.api-sports.io/football/leagues/${competition.externalId}.png`;
  const jsonLd = competition == null
    ? null
    : {
        '@context': 'https://schema.org',
        '@type': 'SportsOrganization',
        name: competition.name,
        url: `${BASE_URL}/ligas/${competition.slug}`,
        sport: 'Football',
        ...(imageUrl != null ? { logo: imageUrl, image: imageUrl } : {}),
        location: competition.country.name,
        description: `Competición de fútbol de ${competition.country.name}.`,
      };

  return (
    <div className="space-y-3">
      {jsonLd != null && (
        <JsonLd data={jsonLd} />
      )}
      {competition != null && (
        <div className="flex justify-end">
          <FavoriteButton
            item={{
              kind: 'competition',
              slug: competition.slug,
              name: competition.name,
              imageUrl,
              subtitle: competition.country.name,
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
