import { FavoriteButton } from '@/components/FavoriteButton';
import { PlayerAdvancedSection } from '@/components/PlayerAdvancedSection';
import { PlayerWatchlistButton } from '@/components/PlayerWatchlistButton';
import { getPlayerAdvancedStats } from '@/lib/playerAdvancedStats';
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
  const advanced = player == null ? null : await getPlayerAdvancedStats(player.id);

  return (
    <div className="space-y-8">
      {player != null && (
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <FavoriteButton
            item={{
              kind: 'player',
              slug: player.slug,
              name: player.knownAs ?? player.fullName,
              imageUrl: player.photoUrl,
              subtitle: player.currentTeam?.name ?? null,
            }}
          />
          <PlayerWatchlistButton
            player={{
              slug: player.slug,
              name: player.knownAs ?? player.fullName,
              imageUrl: player.photoUrl,
              subtitle: player.currentTeam?.name ?? null,
            }}
          />
        </div>
      )}
      {children}
      {advanced != null && <PlayerAdvancedSection data={advanced} />}
    </div>
  );
}
