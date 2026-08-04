import { FavoriteButton } from '@/components/FavoriteButton';
import { getFavoriteTeamIdentity } from '@/lib/favoriteEntities';

export default async function TeamProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await getFavoriteTeamIdentity(slug);

  return (
    <div className="space-y-3">
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
