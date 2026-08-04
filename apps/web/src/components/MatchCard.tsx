import Link from 'next/link';
import { roundLabel, statusLabel } from '@/lib/football';
import type { MatchListItem, MatchListTeam } from '@/lib/matches';

const STATUS_CLASS: Record<string, string> = {
  LIVE: 'border-pitch-danger/40 bg-pitch-danger/10 text-pitch-danger',
  FINISHED: 'border-pitch-accent/30 bg-pitch-accent/10 text-pitch-accent',
  SCHEDULED: 'border-pitch-border bg-pitch-elevated text-pitch-subtle',
  POSTPONED: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  SUSPENDED: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  ABANDONED: 'border-pitch-danger/40 bg-pitch-danger/10 text-pitch-danger',
  CANCELLED: 'border-pitch-danger/40 bg-pitch-danger/10 text-pitch-danger',
};

function competitionLogo(match: MatchListItem): string {
  return (
    match.competition.logoUrl ??
    `https://media.api-sports.io/football/leagues/${match.competition.externalId}.png`
  );
}

function TeamRow({ team, side, showScore }: { team: MatchListTeam | null; side: 'home' | 'away'; showScore: boolean }) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/95 p-1">
        {team?.crestUrl != null ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.crestUrl} alt="" width={24} height={24} loading="lazy" decoding="async" className="h-6 w-6 object-contain" />
        ) : (
          <span aria-hidden="true" className="h-4 w-4 rounded-full bg-pitch-border" />
        )}
      </span>
      <span className="min-w-0 truncate text-sm font-semibold text-white">{team?.name ?? (side === 'home' ? 'Local' : 'Visitante')}</span>
      <span className="text-right font-display text-lg font-bold tabular-nums text-white">
        {showScore ? team?.goals ?? '—' : ''}
      </span>
    </div>
  );
}

export function MatchCard({ match }: { match: MatchListItem }) {
  const kickoff = new Date(match.kickoffAt);
  const finished = match.status === 'FINISHED';
  const live = match.status === 'LIVE';
  const showScore = finished || live;
  const translatedRound = roundLabel(match.round);
  const status = statusLabel(match.status as Parameters<typeof statusLabel>[0]);

  return (
    <article className="fs-panel-interactive group overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-pitch-border/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={competitionLogo(match)} alt="" width={28} height={28} loading="lazy" decoding="async" className="h-7 w-7 object-contain" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{match.competition.name}</p>
            <p className="truncate text-2xs text-pitch-muted">{translatedRound ?? 'Calendario'}</p>
          </div>
        </div>
        <span className={`fs-chip shrink-0 ${STATUS_CLASS[match.status] ?? STATUS_CLASS.SCHEDULED}`}>
          {live && <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
          {status}
        </span>
      </div>

      <div className="space-y-2.5 px-4 py-4">
        <TeamRow team={match.home} side="home" showScore={showScore} />
        <TeamRow team={match.away} side="away" showScore={showScore} />

        {match.hasPenalties && finished && (match.home?.penaltyGoals != null || match.away?.penaltyGoals != null) && (
          <p className="text-right text-2xs text-pitch-muted">
            Penaltis: {match.home?.penaltyGoals ?? '—'}–{match.away?.penaltyGoals ?? '—'}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-pitch-border/70 px-4 py-3 text-xs">
        <time dateTime={match.kickoffAt} className="text-pitch-muted">
          {kickoff.toLocaleString('es-ES', {
            timeZone: 'Europe/Madrid',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
        <Link href={`/partidos/${match.id}`} className="inline-flex items-center gap-1.5 font-semibold text-pitch-accent">
          Ver partido
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </div>
    </article>
  );
}
