import { FavoriteButton } from '@/components/FavoriteButton';
import { getPlayerProfileCore } from '@/lib/playerProfile';

export default async function PlayerProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const player = await getPlayerProfileCore(slug);

  return (
    <div className="space-y-3">
      {player != null && (
        <div className="flex justify-end">
          <FavoriteButton
            item={{
              kind: 'player',
              slug: player.slug,
              name: player.knownAs ?? player.fullName,
              imageUrl: player.photoUrl,
              subtitle: player.currentTeam?.name ?? null,
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
