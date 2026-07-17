/**
 * Mappers: formato crudo de API-Football -> DTOs neutrales.
 * Regla: si el proveedor no da un campo => null. NUNCA inventar ni asumir 0.
 */
import type { MatchPlayerRole, MatchStatus, PositionGroup } from '@futstats/shared';
import type {
  ProviderFixture,
  ProviderInjury,
  ProviderLineupEntry,
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
    name: raw.team.name,
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
  startXI: Array<{ player: { id: number; number: number | null; pos: string | null } }>;
  substitutes: Array<{ player: { id: number; number: number | null; pos: string | null } }>;
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

      out.push({
        playerExternalId: String(entry.player.id),
        teamExternalId: String(teamBlock.team.id),
        isGoalkeeper,
        minutes: s.games.minutes ?? 0,
        rating: toFloatOrNull(s.games.rating),
        isCaptain: s.games.captain,
        positionPlayed: s.games.position ?? null,

        goals: s.goals.total,
        assists: s.goals.assists,
        shotsTotal: s.shots.total,
        shotsOnTarget: s.shots.on,
        passesAttempted: s.passes.total,
        passesCompleted: toIntOrNull(s.passes.accuracy),
        keyPasses: s.passes.key,
        dribblesAttempted: s.dribbles.attempts,
        dribblesCompleted: s.dribbles.success,
        dribbledPast: s.dribbles.past,
        tacklesAttempted: s.tackles.total,
        blocks: s.tackles.blocks,
        interceptions: s.tackles.interceptions,
        duelsTotal: s.duels.total,
        duelsWon: s.duels.won,
        foulsCommitted: s.fouls.committed,
        foulsDrawn: s.fouls.drawn,
        yellowCards: s.cards.yellow,
        redCards: s.cards.red,
        offsides: s.offsides,
        penaltiesScored: s.penalty.scored,
        penaltiesMissed: s.penalty.missed,
        penaltiesWon: s.penalty.won,
        penaltiesCommitted: s.penalty.commited,

        goalsConceded: isGoalkeeper ? s.goals.conceded : null,
        saves: isGoalkeeper ? s.goals.saves : null,
        penaltiesSaved: isGoalkeeper ? s.penalty.saved : null,

        raw: entry,
      });
    }
  }

  return out;
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
  return out;
}
