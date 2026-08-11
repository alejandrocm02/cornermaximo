import type { PositionGroup } from '@cornermaximo/db';
import { FavoriteButton } from '@/components/FavoriteButton';
import { PlayerAdvancedAnalytics } from '@/components/PlayerAdvancedAnalytics';
import { PlayerWatchlistButton } from '@/components/PlayerWatchlistButton';
import { SimilarPlayers } from '@/components/SimilarPlayers';
import { getPlayerAdvancedAnalytics } from '@/lib/playerAdvanced';
import { getPlayerProfileCore } from '@/lib/playerProfile';
import { getSimilarPlayers } from '@/lib/similarPlayers';

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
  const [advanced, similar] = player != null && primaryPosition != null
    ? await Promise.all([
        getPlayerAdvancedAnalytics(player.id, primaryPosition),
        getSimilarPlayers(player.id, primaryPosition),
      ])
    : [null, null];

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
      {similar != null && (
        <div className="pt-5">
          <SimilarPlayers result={similar} />
        </div>
      )}
    </div>
  );
}
