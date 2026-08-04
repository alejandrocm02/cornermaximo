import { FavoriteButton } from '@/components/FavoriteButton';
import { getFavoriteCompetitionIdentity } from '@/lib/favoriteEntities';

export default async function CompetitionProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getFavoriteCompetitionIdentity(slug);

  return (
    <div className="space-y-3">
      {competition != null && (
        <div className="flex justify-end">
          <FavoriteButton
            item={{
              kind: 'competition',
              slug: competition.slug,
              name: competition.name,
              imageUrl:
                competition.logoUrl ??
                `https://media.api-sports.io/football/leagues/${competition.externalId}.png`,
              subtitle: competition.country.name,
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
