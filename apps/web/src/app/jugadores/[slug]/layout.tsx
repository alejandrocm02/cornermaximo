import type { PositionGroup } from '@futstats/db';
import { FavoriteButton } from '@/components/FavoriteButton';
import { PlayerAdvancedAnalytics } from '@/components/PlayerAdvancedAnalytics';
import { PlayerWatchlistButton } from '@/components/PlayerWatchlistButton';
import { getPlayerAdvancedAnalytics } from '@/lib/playerAdvanced';
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
  const primaryPosition = player?.positions.find((position) => position.isPrimary)?.group as PositionGroup | undefined;
  const advanced = player != null && primaryPosition != null
    ? await getPlayerAdvancedAnalytics(player.id, primaryPosition)
    : null;

  return (
    <div className="space-y-3">
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
      {advanced != null && (
        <div className="pt-5">
          <PlayerAdvancedAnalytics analytics={advanced} />
        </div>
      )}
    </div>
  );
}
