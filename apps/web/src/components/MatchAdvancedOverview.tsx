import Link from 'next/link';
import type { MatchDetail, MatchDetailPlayer } from '@/lib/matches';

type TeamSide = 'home' | 'away';

type TeamAggregate = {
  shots: number | null;
  shotsOnTarget: number | null;
  passesAttempted: number | null;
  passesCompleted: number | null;
  keyPasses: number | null;
  tacklesWon: number | null;
  interceptions: number | null;
  saves: number | null;
  yellowCards: number | null;
  redCards: number | null;
};

function sumKnown(values: Array<number | null | undefined>): number | null {
  const known = values.filter((value): value is number => value != null);
  return known.length === 0 ? null : known.reduce((total, value) => total + value, 0);
}

function aggregate(players: MatchDetailPlayer[]): TeamAggregate {
  return {
    shots: sumKnown(players.map((player) => player.fieldStats?.shotsTotal)),
    shotsOnTarget: sumKnown(players.map((player) => player.fieldStats?.shotsOnTarget)),
    passesAttempted: sumKnown(players.map((player) => player.fieldStats?.passesAttempted)),
    passesCompleted: sumKnown(players.map((player) => player.fieldStats?.passesCompleted)),
    keyPasses: sumKnown(players.map((player) => player.fieldStats?.keyPasses)),
    tacklesWon: sumKnown(players.map((player) => player.fieldStats?.tacklesWon)),
    interceptions: sumKnown(players.map((player) => player.fieldStats?.interceptions)),
    saves: sumKnown(players.map((player) => player.goalkeeperStats?.saves)),
    yellowCards: sumKnown(players.map((player) => player.fieldStats?.yellowCards)),
    redCards: sumKnown(players.map((player) => player.fieldStats?.redCards)),
  };
}

function bestPlayer(players: MatchDetailPlayer[]): MatchDetailPlayer | null {
  return players
    .filter((player) => player.minutesPlayed > 0 && player.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null;
}

function groupPosition(position: string | null): 'GK' | 'DF' | 'MF' | 'FW' {
  const value = position?.toUpperCase() ?? '';
  if (/GOAL|KEEP|PORT|GK/.test(value)) return 'GK';
  if (/BACK|DEF|CENTRE-BACK|FULL-BACK|DF/.test(value)) return 'DF';
  if (/MID|WING|MF/.test(value)) return 'MF';
  return 'FW';
}

function PitchLineup({ title, players }: { title: string; players: MatchDetailPlayer[] }) {
  const starters = players.filter((player) => player.role === 'STARTER').slice(0, 11);
  const groups = {
    GK: starters.filter((player) => groupPosition(player.positionPlayed) === 'GK'),
    DF: starters.filter((player) => groupPosition(player.positionPlayed) === 'DF'),
    MF: starters.filter((player) => groupPosition(player.positionPlayed) === 'MF'),
    FW: starters.filter((player) => groupPosition(player.positionPlayed) === 'FW'),
  };

  return (
    <article>
      <h3 className="mb-2 text-center font-display text-sm font-semibold text-white">{title}</h3>
      <div className="relative min-h-[390px] overflow-hidden rounded-2xl border border-pitch-accent/30 bg-[linear-gradient(180deg,rgba(48,229,157,0.14),rgba(8,45,33,0.6))] p-4">
        <div aria-hidden="true" className="absolute inset-4 rounded-xl border border-white/20" />
        <div aria-hidden="true" className="absolute inset-x-4 top-1/2 border-t border-white/20" />
        <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
        <div className="relative z-10 flex min-h-[356px] flex-col justify-between py-2">
          {(['FW', 'MF', 'DF', 'GK'] as const).map((group) => (
            <div key={group} className="flex min-h-16 items-center justify-center gap-2">
              {groups[group].map((player) => (
                <Link key={player.id} href={`/jugadores/${player.slug}`} className="flex w-20 flex-col items-center text-center text-[10px] text-white hover:text-pitch-accent">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-pitch-bg/90 font-bold shadow-lg">
                    {player.shirtNumber ?? '·'}
                  </span>
                  <span className="mt-1 line-clamp-2 leading-tight">{player.name}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      {starters.length > 0 && (
        <p className="mt-2 text-center text-2xs text-pitch-muted">
          Distribución aproximada por la posición registrada en el acta; no representa coordenadas tácticas oficiales.
        </p>
      )}
    </article>
  );
}

function StatRow({ label, home, away }: { label: string; home: number | null; away: number | null }) {
  const max = Math.max(home ?? 0, away ?? 0, 1);
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_8rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs">
      <span className="text-right font-semibold tabular-nums text-white">{home ?? '—'}</span>
      <span className="h-2 overflow-hidden rounded-full bg-pitch-elevated">
        <span className="block h-full rounded-full bg-pitch-accent" style={{ width: `${((home ?? 0) / max) * 100}%` }} />
      </span>
      <span className="text-center text-pitch-muted">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-pitch-elevated">
        <span className="ml-auto block h-full rounded-full bg-pitch-accent2" style={{ width: `${((away ?? 0) / max) * 100}%` }} />
      </span>
      <span className="font-semibold tabular-nums text-white">{away ?? '—'}</span>
    </div>
  );
}

export function MatchAdvancedOverview({ match }: { match: MatchDetail }) {
  const homePlayers = match.players.filter((player) => player.teamId === match.home?.id);
  const awayPlayers = match.players.filter((player) => player.teamId === match.away?.id);
  const home = aggregate(homePlayers);
  const away = aggregate(awayPlayers);
  const standout = bestPlayer(match.players);
  const hasAggregates = Object.values(home).some((value) => value != null) || Object.values(away).some((value) => value != null);
  const eventTeam = (externalId: string | null): TeamSide | null => {
    if (externalId == null) return null;
    if (match.home != null && String(match.home.id) === externalId) return 'home';
    if (match.away != null && String(match.away.id) === externalId) return 'away';
    return null;
  };

  return (
    <section className="space-y-6" aria-labelledby="resumen-avanzado-partido">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="fs-eyebrow">Lectura del encuentro</p>
          <h2 id="resumen-avanzado-partido" className="mt-1 text-2xl font-bold">Resumen avanzado</h2>
        </div>
        <span className="fs-chip">Datos derivados de actas y jugadores</span>
      </div>

      {standout != null && (
        <article className="fs-panel flex flex-wrap items-center gap-4 p-4">
          {standout.photoUrl != null ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={standout.photoUrl} alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="h-16 w-16 rounded-full bg-pitch-elevated" />
          )}
          <div className="min-w-0 flex-1">
            <p className="fs-eyebrow">Jugador destacado</p>
            <Link href={`/jugadores/${standout.slug}`} className="mt-1 block truncate font-display text-xl font-bold text-white hover:text-pitch-accent">
              {standout.name}
            </Link>
            <p className="text-sm text-pitch-muted">{standout.teamName} · {standout.minutesPlayed} minutos</p>
          </div>
          <div className="rounded-xl border border-pitch-accent/30 bg-pitch-accent/10 px-4 py-3 text-center">
            <p className="font-display text-2xl font-bold text-pitch-accent">{standout.rating?.toFixed(1)}</p>
            <p className="text-2xs uppercase tracking-wide text-pitch-muted">Valoración</p>
          </div>
        </article>
      )}

      {hasAggregates && (
        <article className="fs-panel space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-3 text-xs font-semibold">
            <span className="truncate text-right text-white">{match.home?.name ?? 'Local'}</span>
            <span className="text-center text-pitch-muted">Comparativa</span>
            <span className="truncate text-white">{match.away?.name ?? 'Visitante'}</span>
          </div>
          <StatRow label="Tiros" home={home.shots} away={away.shots} />
          <StatRow label="A puerta" home={home.shotsOnTarget} away={away.shotsOnTarget} />
          <StatRow label="Pases" home={home.passesCompleted} away={away.passesCompleted} />
          <StatRow label="Pases clave" home={home.keyPasses} away={away.keyPasses} />
          <StatRow label="Entradas ganadas" home={home.tacklesWon} away={away.tacklesWon} />
          <StatRow label="Intercepciones" home={home.interceptions} away={away.interceptions} />
          <StatRow label="Paradas" home={home.saves} away={away.saves} />
          <StatRow label="Amarillas" home={home.yellowCards} away={away.yellowCards} />
          <p className="text-2xs leading-5 text-pitch-muted">
            Totales calculados a partir de estadísticas individuales sincronizadas. No se muestran posesión, córners ni faltas colectivas porque aún no existen como datos oficiales en el esquema.
          </p>
        </article>
      )}

      {match.events.length > 0 && (
        <article className="fs-panel p-4 sm:p-5">
          <h3 className="font-display text-lg font-semibold text-white">Cronología visual</h3>
          <div className="relative mt-5 h-20">
            <div className="absolute inset-x-2 top-8 h-1 rounded-full bg-pitch-elevated" />
            {[0, 15, 30, 45, 60, 75, 90].map((minute) => (
              <span key={minute} className="absolute top-10 -translate-x-1/2 text-[9px] text-pitch-muted" style={{ left: `${(minute / 90) * 100}%` }}>{minute}&apos;</span>
            ))}
            {match.events.map((event) => {
              const minute = Math.min(event.minute + (event.extraMinute ?? 0), 90);
              const side = eventTeam(event.teamExternalId);
              return (
                <span
                  key={event.id}
                  title={`${event.minute}' ${event.type}${event.player != null ? ` · ${event.player.name}` : ''}`}
                  className={`absolute grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full border text-[9px] font-bold ${
                    side === 'away' ? 'top-8 border-pitch-accent2 bg-pitch-accent2/20 text-pitch-accent2' : 'top-3 border-pitch-accent bg-pitch-accent/20 text-pitch-accent'
                  }`}
                  style={{ left: `${(minute / 90) * 100}%` }}
                >
                  {event.type.includes('GOAL') ? 'G' : event.type.includes('CARD') || event.type.includes('YELLOW') || event.type.includes('RED') ? 'T' : '·'}
                </span>
              );
            })}
          </div>
        </article>
      )}

      {match.players.some((player) => player.role === 'STARTER') && (
        <div className="grid gap-5 lg:grid-cols-2">
          <PitchLineup title={match.home?.name ?? 'Local'} players={homePlayers} />
          <PitchLineup title={match.away?.name ?? 'Visitante'} players={awayPlayers} />
        </div>
      )}
    </section>
  );
}
