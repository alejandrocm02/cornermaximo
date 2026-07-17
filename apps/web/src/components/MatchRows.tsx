import type { MatchStatus } from '@futstats/shared';
import Link from 'next/link';
import { formatMatchDate, statusLabel } from '@/lib/football';

type MatchRow = {
  id: number;
  kickoffAt: Date;
  status: MatchStatus;
  round: string | null;
  season?: { year: number; competition: { name: string; slug: string } };
  teams: Array<{
    isHome: boolean;
    goals: number | null;
    penaltyGoals?: number | null;
    team: { name: string; slug?: string | null };
  }>;
};

export function MatchRows({ matches, empty }: { matches: MatchRow[]; empty: string }) {
  if (matches.length === 0) {
    return <p className="text-sm text-pitch-muted">{empty}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-pitch-border">
      <div className="divide-y divide-pitch-border/70 bg-pitch-card">
        {matches.map((match) => {
          const home = match.teams.find((team) => team.isHome);
          const away = match.teams.find((team) => !team.isHome);
          return (
            <div key={match.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[150px_1fr_auto] sm:items-center">
              <div className="text-xs text-pitch-muted">
                <p>{formatMatchDate(match.kickoffAt)}</p>
                <p>{match.round ?? statusLabel(match.status)}</p>
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {home?.team.slug != null ? (
                    <Link href={`/equipos/${home.team.slug}`} className="hover:text-pitch-accent">
                      {home.team.name}
                    </Link>
                  ) : (
                    home?.team.name
                  )}
                  <span className="px-2 text-pitch-accent">
                    {home?.goals ?? '-'}-{away?.goals ?? '-'}
                  </span>
                  {away?.team.slug != null ? (
                    <Link href={`/equipos/${away.team.slug}`} className="hover:text-pitch-accent">
                      {away.team.name}
                    </Link>
                  ) : (
                    away?.team.name
                  )}
                </p>
                {match.season != null && (
                  <Link href={`/ligas/${match.season.competition.slug}`} className="text-xs text-pitch-muted hover:text-pitch-accent">
                    {match.season.competition.name}
                  </Link>
                )}
              </div>
              <span className="text-xs text-pitch-muted">{statusLabel(match.status)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
