/**
 * Mappers: formato crudo de API-Football -> DTOs neutrales.
 * Regla: si el proveedor no da un campo => null. NUNCA inventar ni asumir 0.
 */
import { displayTeamName } from '@cornermaximo/shared';
import type { MatchPlayerRole, MatchStatus, PositionGroup } from '@cornermaximo/shared';
import type {
  ProviderFixture,
  ProviderInjury,
  ProviderLineupEntry,
  ProviderMatchEvent,
  ProviderMatchEventType,
  ProviderPlayer,
  ProviderPlayerMatchStats,
  ProviderStandingRow,
  ProviderTeam,
} from '../types';

// ---- helpers ----

function toIntOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toFloatOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** "185 cm" -> 185 ; "75 kg" -> 75 */
function parseMeasure(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = v.match(/(\d+)/);
  return m?.[1] != null ? parseInt(m[1], 10) : null;
}

const POSITION_MAP: Record<string, PositionGroup> = {
  Goalkeeper: 'GK',
  Defender: 'DF',
  Midfielder: 'MF',
  Attacker: 'FW',
};

/** Estados de API-Football (fixture.status.short) -> MatchStatus del dominio. */
const STATUS_MAP: Record<string, MatchStatus> = {
  TBD: 'SCHEDULED',
  NS: 'SCHEDULED',
  '1H': 'LIVE',
  HT: 'LIVE',
  '2H': 'LIVE',
  ET: 'LIVE',
  BT: 'LIVE',
  P: 'LIVE',
  LIVE: 'LIVE',
  FT: 'FINISHED',
  AET: 'FINISHED',
  PEN: 'FINISHED',
  PST: 'POSTPONED',
  SUSP: 'SUSPENDED',
  INT: 'SUSPENDED',
  ABD: 'ABANDONED',
  CANC: 'CANCELLED',
  AWD: 'FINISHED', // adjudicado
  WO: 'FINISHED', // walkover
};

export function mapMatchStatus(short: string): MatchStatus {
  return STATUS_MAP[short] ?? 'SCHEDULED';
}

// ---- mappers ----

/* Tipos crudos mínimos (solo los campos que usamos). */
interface RawTeamResponse {
  team: {
    id: number;
    name: string;
    code: string | null;
    founded: number | null;
    logo: string | null;
    country?: string | null;
    national?: boolean;
  };
  venue: { name: string | null; city: string | null; capacity: number | null } | null;
}

/**
 * `fallbackCountry` solo se usa si el proveedor no da país en el propio equipo.
 * En competiciones multinacionales (Mundial, Champions...) cada equipo trae su país;
 * en ligas domésticas, todos comparten el país de la liga (pero el proveedor también lo da).
 */
export function mapTeam(raw: RawTeamResponse, fallbackCountry: string): ProviderTeam {
  return {
    externalId: String(raw.team.id),
    name: displayTeamName(raw.team.name),
    shortName: raw.team.code ?? null,
    crestUrl: raw.team.logo ?? null,
    founded: raw.team.founded ?? null,
    country: raw.team.country ?? fallbackCountry,
    isNational: raw.team.national ?? false,
    stadiumName: raw.venue?.name ?? null,
    stadiumCity: raw.venue?.city ?? null,
    stadiumCapacity: raw.venue?.capacity ?? null,
  };
}

interface RawSquadPlayer {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
}

export function mapSquadPlayer(raw: RawSquadPlayer): ProviderPlayer {
  return {
    externalId: String(raw.id),
    fullName: raw.name,
    knownAs: null,
    photoUrl: raw.photo ?? null,
    birthDate: null, // el endpoint de plantillas no lo da; se enriquece con /players
    nationality: null,
    heightCm: null,
    weightKg: null,
    preferredFoot: null,
    shirtNumber: raw.number ?? null,
    positionGroup: raw.position != null ? (POSITION_MAP[raw.position] ?? null) : null,
    isInjured: false,
  };
}

interface RawPlayerProfile {
  player: {
    id: number;
    name: string;
    firstname: string | null;
    lastname: string | null;
    birth: { date: string | null } | null;
    nationality: string | null;
    height: string | null;
    weight: string | null;
    photo: string | null;
    injured: boolean | null;
  };
}

/** Enriquecimiento del perfil (endpoint /players). */
export function mapPlayerProfile(raw: RawPlayerProfile): Partial<ProviderPlayer> & { externalId: string } {
  const p = raw.player;
  const fullName =
    p.firstname != null && p.lastname != null ? `${p.firstname} ${p.lastname}` : p.name;
  return {
    externalId: String(p.id),
    fullName,
    knownAs: p.name !== fullName ? p.name : null,
    birthDate: p.birth?.date ?? null,
    nationality: p.nationality ?? null,
    heightCm: parseMeasure(p.height),
    weightKg: parseMeasure(p.weight),
    photoUrl: p.photo ?? null,
    isInjured: p.injured ?? false,
  };
}

interface RawFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: { id: number; season: number; round: string | null };
  teams: { home: { id: number }; away: { id: number } };
  goals: { home: number | null; away: number | null };
  score: {
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export function mapFixture(raw: RawFixture): ProviderFixture {
  return {
    externalId: String(raw.fixture.id),
    competitionExternalId: String(raw.league.id),
    season: raw.league.season,
    round: raw.league.round ?? null,
    kickoffAt: raw.fixture.date,
    status: mapMatchStatus(raw.fixture.status.short),
    homeTeamExternalId: String(raw.teams.home.id),
    awayTeamExternalId: String(raw.teams.away.id),
    homeGoals: raw.goals.home,
    awayGoals: raw.goals.away,
    hasExtraTime: raw.score.extratime.home != null,
    hasPenalties: raw.score.penalty.home != null,
    homePenaltyGoals: raw.score.penalty.home,
    awayPenaltyGoals: raw.score.penalty.away,
  };
}

interface RawLineup {
  team: { id: number };
  startXI: Array<{ player: { id: number; name?: string | null; number: number | null; pos: string | null } }>;
  substitutes: Array<{ player: { id: number; name?: string | null; number: number | null; pos: string | null } }>;
}

export function mapLineups(raws: RawLineup[]): ProviderLineupEntry[] {
  const entries: ProviderLineupEntry[] = [];
  for (const raw of raws) {
    const push = (
      list: RawLineup['startXI'],
      role: MatchPlayerRole,
    ) => {
      for (const { player } of list) {
        entries.push({
          playerExternalId: String(player.id),
          playerName: player.name?.trim() || null,
          teamExternalId: String(raw.team.id),
          role,
          positionPlayed: player.pos ?? null,
          shirtNumber: player.number ?? null,
        });
      }
    };
    push(raw.startXI ?? [], 'STARTER');
    // Los suplentes se marcan SUBSTITUTE; si luego sus stats dicen 0 minutos,
    // el sincronizador los reclasifica a BENCH_UNUSED.
    push(raw.substitutes ?? [], 'SUBSTITUTE');
  }
  return entries;
}

interface RawFixturePlayers {
  team: { id: number };
  players: Array<{
    player: { id: number };
    statistics: Array<{
      games: {
        minutes: number | null;
        position: string | null;
        rating: string | null;
        captain: boolean;
      };
      goals: { total: number | null; conceded: number | null; assists: number | null; saves: number | null };
      shots: { total: number | null; on: number | null };
      passes: { total: number | null; key: number | null; accuracy: string | null };
      tackles: { total: number | null; blocks: number | null; interceptions: number | null };
      duels: { total: number | null; won: number | null };
      dribbles: { attempts: number | null; success: number | null; past: number | null };
      fouls: { drawn: number | null; committed: number | null };
      cards: { yellow: number | null; red: number | null };
      penalty: {
        won: number | null;
        commited: number | null; // sic: así lo escribe API-Football
        scored: number | null;
        missed: number | null;
        saved: number | null;
      };
      offsides: number | null;
    }>;
  }>;
}

type RawPlayerStatistics = RawFixturePlayers['players'][number]['statistics'][number];

/**
 * API-Football omite los contadores que valen cero: un jugador que no marca
 * llega con `goals.total: null`, no con `0`. Medido en producción (8-oct-2026,
 * 130.639 actuaciones con minutos): goles 114.370 nulos frente a 4.647 ceros;
 * faltas, tiros, pases clave, entradas, intercepciones y duelos, igual. Las
 * tarjetas y casi siempre las asistencias sí llegan como 0.
 *
 * Por eso, en una fila con estadísticas reales, un contador nulo es 0. Solo se
 * conserva null cuando la fila entera viene vacía (todos los contadores nulos):
 * eso sí es un partido sin estadísticas y no se inventan ceros.
 */
function detailedCounters(s: RawPlayerStatistics): Array<number | null> {
  return [
    s.goals.total,
    s.goals.assists,
    s.shots.total,
    s.shots.on,
    s.passes.total,
    s.passes.key,
    s.tackles.total,
    s.tackles.blocks,
    s.tackles.interceptions,
    s.duels.total,
    s.duels.won,
    s.dribbles.attempts,
    s.dribbles.success,
    s.dribbles.past,
    s.fouls.drawn,
    s.fouls.committed,
    s.offsides,
  ];
}

export function hasDetailedStatistics(s: RawPlayerStatistics): boolean {
  return (s.games.minutes ?? 0) > 0 && detailedCounters(s).some((value) => value != null);
}

/**
 * `passes.accuracy` de API-Football es el Nº de pases completados (string), no un %.
 */
export function mapFixturePlayers(raws: RawFixturePlayers[]): ProviderPlayerMatchStats[] {
  const out: ProviderPlayerMatchStats[] = [];

  for (const teamBlock of raws) {
    for (const entry of teamBlock.players) {
      const s = entry.statistics[0];
      if (s == null) continue;

      const isGoalkeeper = s.games.position === 'G';
      const detailed = hasDetailedStatistics(s);
      // Contador de API-Football: null => 0 en una fila con estadísticas reales.
      const count = (value: number | null): number | null => (value == null && detailed ? 0 : value);

      out.push({
        playerExternalId: String(entry.player.id),
        teamExternalId: String(teamBlock.team.id),
        isGoalkeeper,
        minutes: s.games.minutes ?? 0,
        rating: toFloatOrNull(s.games.rating),
        isCaptain: s.games.captain,
        positionPlayed: s.games.position ?? null,

        goals: count(s.goals.total),
        assists: count(s.goals.assists),
        shotsTotal: count(s.shots.total),
        shotsOnTarget: count(s.shots.on),
        passesAttempted: count(s.passes.total),
        passesCompleted: count(toIntOrNull(s.passes.accuracy)),
        keyPasses: count(s.passes.key),
        dribblesAttempted: count(s.dribbles.attempts),
        dribblesCompleted: count(s.dribbles.success),
        dribbledPast: count(s.dribbles.past),
        tacklesAttempted: count(s.tackles.total),
        blocks: count(s.tackles.blocks),
        interceptions: count(s.tackles.interceptions),
        duelsTotal: count(s.duels.total),
        duelsWon: count(s.duels.won),
        foulsCommitted: count(s.fouls.committed),
        foulsDrawn: count(s.fouls.drawn),
        yellowCards: count(s.cards.yellow),
        redCards: count(s.cards.red),
        offsides: count(s.offsides),
        penaltiesScored: count(s.penalty.scored),
        penaltiesMissed: count(s.penalty.missed),
        penaltiesWon: count(s.penalty.won),
        penaltiesCommitted: count(s.penalty.commited),

        goalsConceded: isGoalkeeper ? s.goals.conceded : null,
        saves: isGoalkeeper ? count(s.goals.saves) : null,
        penaltiesSaved: isGoalkeeper ? count(s.penalty.saved) : null,

        raw: entry,
      });
    }
  }

  return out;
}

export interface RawFixtureEvent {
  time: { elapsed: number | null; extra: number | null };
  team: { id: number; name?: string | null } | null;
  player: { id: number | null; name: string | null } | null;
  assist: { id: number | null; name: string | null } | null;
  type: string;
  detail: string | null;
  comments: string | null;
}

function mapEventType(type: string, detail: string | null): ProviderMatchEventType | null {
  const normalizedType = type.toLowerCase();
  const normalizedDetail = (detail ?? '').toLowerCase();

  if (normalizedType === 'goal') {
    if (normalizedDetail.includes('missed penalty')) return 'MISSED_PENALTY';
    if (normalizedDetail.includes('own goal')) return 'OWN_GOAL';
    if (normalizedDetail.includes('penalty')) return 'PENALTY_GOAL';
    return 'GOAL';
  }
  if (normalizedType === 'card') {
    if (normalizedDetail.includes('second yellow')) return 'SECOND_YELLOW';
    if (normalizedDetail.includes('red')) return 'RED_CARD';
    return 'YELLOW_CARD';
  }
  if (normalizedType === 'subst' || normalizedType === 'substitution') return 'SUBSTITUTION';
  if (normalizedType === 'var') return 'VAR';
  return null;
}

/** Descarta los eventos de tipo desconocido o sin minuto: no se pueden situar en el partido. */
export function mapFixtureEvents(raws: RawFixtureEvent[]): ProviderMatchEvent[] {
  return raws.flatMap((raw) => {
    const type = mapEventType(raw.type, raw.detail);
    if (type == null || raw.time.elapsed == null) return [];
    return [
      {
        teamExternalId: raw.team?.id != null ? String(raw.team.id) : null,
        playerExternalId: raw.player?.id != null ? String(raw.player.id) : null,
        assistExternalId: raw.assist?.id != null ? String(raw.assist.id) : null,
        type,
        minute: raw.time.elapsed,
        extraMinute: raw.time.extra ?? null,
        detail: [raw.detail, raw.comments].filter(Boolean).join(' · ') || null,
      },
    ];
  });
}

interface RawInjury {
  player: { id: number; type: string | null; reason: string | null };
  fixture: { id: number | null; date: string | null } | null;
}

export function mapInjury(raw: RawInjury): ProviderInjury {
  return {
    playerExternalId: String(raw.player.id),
    type: raw.player.type ?? null,
    reason: raw.player.reason ?? null,
    fixtureExternalId: raw.fixture?.id != null ? String(raw.fixture.id) : null,
    date: raw.fixture?.date ?? null,
  };
}

interface RawStandingsResponse {
  league: {
    standings: Array<
      Array<{
        rank: number;
        team: { id: number };
        points: number;
        group?: string | null; // p.ej. "Group A" en el Mundial; ausente en ligas de tabla única
        all: {
          played: number;
          win: number;
          draw: number;
          lose: number;
          goals: { for: number; against: number };
        };
        form: string | null;
      }>
    >;
  };
}

/**
 * API-Football devuelve `standings` como un array DE GRUPOS: `[[tabla]]` en ligas de tabla
 * única, pero `[[Grupo A], [Grupo B], ...]` en competiciones por grupos (Mundial, Champions
 * fase de liga con clasificación regional, etc.). Recorremos TODOS los grupos, no solo el
 * primero, y guardamos la etiqueta de grupo cuando el proveedor la da.
 */
export function mapStandings(raw: RawStandingsResponse): ProviderStandingRow[] {
  const groups = raw.league.standings ?? [];
  const out: ProviderStandingRow[] = [];
  for (const table of groups) {
    for (const row of table) {
      out.push({
        teamExternalId: String(row.team.id),
        group: row.group ?? null,
        position: row.rank,
        played: row.all.played,
        won: row.all.win,
        drawn: row.all.draw,
        lost: row.all.lose,
        goalsFor: row.all.goals.for,
        goalsAgainst: row.all.goals.against,
        points: row.points,
        form: row.form,
      });
    }
  }

  /*
   * En el Mundial el proveedor añade al final una tabla auxiliar `Group Stage`
   * con el ranking de mejores terceros. Esas selecciones ya existen en su
   * grupo real y Standing tiene una única fila por (temporada, equipo), por lo
   * que guardar la tabla auxiliar sobrescribiría la posición 3 y dejaría cada
   * grupo visible con 1, 2 y 4. Solo descartamos filas auxiliares duplicadas:
   * una competición cuya única tabla se llame `Group Stage` sigue funcionando.
   */
  const appearances = new Map<string, number>();
  for (const row of out) {
    appearances.set(row.teamExternalId, (appearances.get(row.teamExternalId) ?? 0) + 1);
  }
  return out.filter(
    (row) => row.group !== 'Group Stage' || appearances.get(row.teamExternalId) === 1,
  );
}

interface RawTransferEntry {
  player: { id: number; name: string };
  transfers: Array<{
    date: string;
    type: string | null;
    teams: {
      in: { id: number | null; name: string | null } | null;
      out: { id: number | null; name: string | null } | null;
    };
  }>;
}

export function mapTransfers(raws: RawTransferEntry[]): import('../types').ProviderTransfer[] {
  const out: import('../types').ProviderTransfer[] = [];
  for (const entry of raws) {
    for (const t of entry.transfers ?? []) {
      if (t.date == null) continue;
      out.push({
        playerExternalId: String(entry.player.id),
        playerName: entry.player.name,
        date: t.date,
        typeRaw: t.type ?? null,
        teamInExternalId: t.teams.in?.id != null ? String(t.teams.in.id) : null,
        teamInName: t.teams.in?.name ?? null,
        teamOutExternalId: t.teams.out?.id != null ? String(t.teams.out.id) : null,
        teamOutName: t.teams.out?.name ?? null,
      });
    }
  }
  return out;
}
