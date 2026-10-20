/**
 * Datos de la página de una competición UEFA de clubes (Champions, Europa y
 * Conference League) en su formato desde 2024-25: una fase de liga de 36
 * equipos y eliminatorias.
 */
import { prisma } from '@cornermaximo/db';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG, MATCHES_CACHE_TAG } from '@/lib/cache';
import { DISPLAY_TIME_ZONE } from '@/lib/football';

/** Puestos de la fase de liga: 1-8 a octavos, 9-24 al play-off, 25-36 eliminados. */
export type LeaguePhaseZone = 'ROUND_OF_16' | 'PLAYOFF' | 'ELIMINATED';

export const LEAGUE_PHASE_ZONES: Record<LeaguePhaseZone, { label: string; from: number; to: number }> = {
  ROUND_OF_16: { label: 'Octavos de final', from: 1, to: 8 },
  PLAYOFF: { label: 'Play-off de eliminatorias', from: 9, to: 24 },
  // Es una zona, no un estado: tras dos jornadas nadie está eliminado todavía.
  ELIMINATED: { label: 'Eliminación', from: 25, to: 36 },
};

export function leaguePhaseZone(position: number): LeaguePhaseZone {
  if (position <= LEAGUE_PHASE_ZONES.ROUND_OF_16.to) return 'ROUND_OF_16';
  if (position <= LEAGUE_PHASE_ZONES.PLAYOFF.to) return 'PLAYOFF';
  return 'ELIMINATED';
}

export interface UefaMatchTeam {
  isHome: boolean;
  goals: number | null;
  penaltyGoals: number | null;
  team: { name: string; slug: string; crestUrl: string | null };
}

export interface UefaMatch {
  id: number;
  round: string | null;
  kickoffAt: Date;
  status: string;
  teams: UefaMatchTeam[];
}

export interface UefaRound {
  round: string;
  matches: UefaMatch[];
  /** Algún partido de la ronda está por jugar o en juego. */
  pending: boolean;
}

/**
 * Agrupa los partidos por ronda, en orden cronológico (por el primer partido de
 * cada ronda). No depende de los nombres del proveedor: si cambian, el orden se
 * mantiene.
 */
export function groupMatchesByRound(matches: UefaMatch[]): UefaRound[] {
  const byRound = new Map<string, UefaMatch[]>();
  for (const match of [...matches].sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime())) {
    const key = match.round ?? 'Sin ronda';
    const list = byRound.get(key) ?? [];
    list.push(match);
    byRound.set(key, list);
  }
  return [...byRound.entries()].map(([round, list]) => ({
    round,
    matches: list,
    pending: list.some((match) => match.status === 'SCHEDULED' || match.status === 'LIVE'),
  }));
}

/**
 * Ronda que se muestra por defecto: la que se pide si existe; si no, la primera
 * con partidos pendientes (la jornada en curso o la próxima) y, con todo jugado,
 * la última.
 */
export function selectRound(rounds: UefaRound[], requested: string | undefined): UefaRound | null {
  if (rounds.length === 0) return null;
  if (requested != null) {
    const match = rounds.find((round) => round.round === requested);
    if (match != null) return match;
  }
  return rounds.find((round) => round.pending) ?? rounds[rounds.length - 1]!;
}

const DAY_FORMAT = new Intl.DateTimeFormat('es-ES', { timeZone: DISPLAY_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'short' });
const TIME_FORMAT = new Intl.DateTimeFormat('es-ES', { timeZone: DISPLAY_TIME_ZONE, hour: '2-digit', minute: '2-digit' });

export function formatKickoffTime(date: Date): string {
  return TIME_FORMAT.format(date);
}

/**
 * Partidos de una ronda agrupados por día (hora de Madrid). Mostrar el día una
 * vez por grupo deja sitio en móvil para los nombres de los equipos.
 */
export function groupMatchesByDay(matches: UefaMatch[]): Array<{ day: string; matches: UefaMatch[] }> {
  const groups: Array<{ day: string; matches: UefaMatch[] }> = [];
  for (const match of matches) {
    const raw = DAY_FORMAT.format(match.kickoffAt);
    const day = raw.charAt(0).toUpperCase() + raw.slice(1);
    const last = groups.at(-1);
    if (last?.day === day) last.matches.push(match);
    else groups.push({ day, matches: [match] });
  }
  return groups;
}

async function queryCompetitionSeason(seasonId: number) {
  const [standings, matches] = await Promise.all([
    prisma.standing.findMany({
      where: { seasonId },
      select: {
        id: true,
        position: true,
        played: true,
        won: true,
        drawn: true,
        lost: true,
        goalsFor: true,
        goalsAgainst: true,
        points: true,
        form: true,
        updatedAt: true,
        team: { select: { name: true, slug: true, crestUrl: true } },
      },
      orderBy: { position: 'asc' },
    }),
    prisma.match.findMany({
      where: { seasonId },
      select: {
        id: true,
        round: true,
        kickoffAt: true,
        status: true,
        teams: {
          select: {
            isHome: true,
            goals: true,
            penaltyGoals: true,
            team: { select: { name: true, slug: true, crestUrl: true } },
          },
        },
      },
      orderBy: { kickoffAt: 'asc' },
    }),
  ]);
  return { standings, matches };
}

const cachedCompetitionSeason = unstable_cache(queryCompetitionSeason, ['uefa-competition-season-v1'], {
  // Igual que la portada: las invalidaciones del sync y del directo la refrescan;
  // los 5 minutos son la red de seguridad.
  revalidate: 5 * 60,
  tags: [FOOTBALL_DATA_CACHE_TAG, MATCHES_CACHE_TAG],
});

/** La caché de datos guarda JSON: las fechas vuelven como texto y se restauran aquí. */
export async function getUefaCompetitionSeason(seasonId: number) {
  const data = await cachedCompetitionSeason(seasonId);
  return {
    standings: data.standings.map((row) => ({ ...row, updatedAt: new Date(row.updatedAt) })),
    matches: data.matches.map((match) => ({ ...match, kickoffAt: new Date(match.kickoffAt) })) as UefaMatch[],
  };
}
