import type { MatchStatus } from '@futstats/shared';
import Link from 'next/link';
import { formatMatchDate, roundLabel, statusLabel } from '@/lib/football';

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

/** Color del indicador de estado. En directo destaca; finalizado es neutro. */
function statusTone(status: MatchStatus): string {
  switch (status) {
    case 'LIVE':
      return 'border-pitch-danger/40 bg-pitch-danger/10 text-pitch-danger';
    case 'SCHEDULED':
      return 'border-pitch-accent2/30 bg-pitch-accent2/10 text-pitch-accent2';
    case 'POSTPONED':
    case 'SUSPENDED':
    case 'ABANDONED':
    case 'CANCELLED':
      return 'border-pitch-warning/30 bg-pitch-warning/10 text-pitch-warning';
    case 'FINISHED':
    default:
      return 'border-pitch-border bg-pitch-elevated text-pitch-muted';
  }
}

export function MatchRows({ matches, empty }: { matches: MatchRow[]; empty: string }) {
  if (matches.length === 0) {
    return (
      <div className="fs-panel grid place-items-center px-4 py-10 text-center">
        <p className="max-w-xs text-sm text-pitch-muted">{empty}</p>
      </div>
    );
  }

  return (
    <div className="fs-panel overflow-hidden">
      <ul className="divide-y divide-pitch-border/60">
        {matches.map((match) => {
          const home = match.teams.find((team) => team.isHome);
          const away = match.teams.find((team) => !team.isHome);
          const played = home?.goals != null && away?.goals != null;
          const homeWon = played && home!.goals! > away!.goals!;
          const awayWon = played && away!.goals! > home!.goals!;

          return (
            <li
              key={match.id}
              className="grid gap-2 px-4 py-3.5 transition-colors hover:bg-pitch-elevated/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
            >
              <div className="min-w-0">
                {/* Marcador: el equipo ganador va en blanco y negrita, de modo
                    que el resultado se lee sin depender solo del color. */}
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <TeamName name={home?.team.name} slug={home?.team.slug} emphasis={homeWon} />
                  <span className="font-display text-base font-bold tabular-nums text-white">
                    {home?.goals ?? '·'}
                    <span className="px-1 text-pitch-muted">–</span>
                    {away?.goals ?? '·'}
                  </span>
                  <TeamName name={away?.team.name} slug={away?.team.slug} emphasis={awayWon} />
                </p>

                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-pitch-muted">
                  <span>{formatMatchDate(match.kickoffAt)}</span>
                  {match.season != null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <Link
                        href={`/ligas/${match.season.competition.slug}`}
                        className="rounded transition-colors hover:text-pitch-accent"
                      >
                        {match.season.competition.name}
                      </Link>
                    </>
                  )}
                  {roundLabel(match.round) != null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{roundLabel(match.round)}</span>
                    </>
                  )}
                </p>
              </div>

              <span
                className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold ${statusTone(
                  match.status,
                )}`}
              >
                {match.status === 'LIVE' && (
                  <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                )}
                {statusLabel(match.status)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TeamName({
  name,
  slug,
  emphasis,
}: {
  name: string | undefined;
  slug: string | null | undefined;
  emphasis: boolean;
}) {
  const className = `truncate rounded transition-colors ${
    emphasis ? 'font-semibold text-white' : 'text-pitch-subtle'
  }`;

  if (name == null) return <span className={className}>—</span>;
  if (slug == null) return <span className={className}>{name}</span>;

  return (
    <Link href={`/equipos/${slug}`} className={`${className} hover:text-pitch-accent`}>
      {name}
    </Link>
  );
}
