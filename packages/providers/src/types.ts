/**
 * DTOs neutrales del dominio: lo que devuelve CUALQUIER proveedor tras mapear.
 * El resto de la aplicación solo conoce estos tipos, nunca el formato crudo de la API.
 * null = el proveedor no da ese dato.
 */
import type {
  MatchPlayerRole,
  MatchStatus,
  PositionGroup,
  PreferredFoot,
} from '@futstats/shared';

export interface ProviderCompetition {
  externalId: string;
  name: string;
  country: string;
  type: 'LEAGUE' | 'CUP';
  logoUrl: string | null;
  season: number;
}

export interface ProviderTeam {
  externalId: string;
  name: string;
  shortName: string | null;
  crestUrl: string | null;
  founded: number | null;
  country: string;
  stadiumName: string | null;
  stadiumCity: string | null;
  stadiumCapacity: number | null;
}

export interface ProviderPlayer {
  externalId: string;
  fullName: string;
  knownAs: string | null;
  photoUrl: string | null;
  birthDate: string | null; // ISO yyyy-mm-dd
  nationality: string | null;
  heightCm: number | null;
  weightKg: number | null;
  preferredFoot: PreferredFoot | null;
  shirtNumber: number | null;
  positionGroup: PositionGroup | null;
  isInjured: boolean;
}

export interface ProviderFixture {
  externalId: string;
  competitionExternalId: string;
  season: number;
  round: string | null;
  kickoffAt: string; // ISO datetime
  status: MatchStatus;
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  hasExtraTime: boolean;
  hasPenalties: boolean;
  homePenaltyGoals: number | null;
  awayPenaltyGoals: number | null;
}

export interface ProviderLineupEntry {
  playerExternalId: string;
  teamExternalId: string;
  role: MatchPlayerRole;
  positionPlayed: string | null;
  shirtNumber: number | null;
}

/** Estadísticas de un jugador en un partido, ya normalizadas. */
export interface ProviderPlayerMatchStats {
  playerExternalId: string;
  teamExternalId: string;
  isGoalkeeper: boolean;
  minutes: number;
  rating: number | null;
  isCaptain: boolean;
  positionPlayed: string | null;

  // Campo
  goals: number | null;
  assists: number | null;
  shotsTotal: number | null;
  shotsOnTarget: number | null;
  passesAttempted: number | null;
  passesCompleted: number | null;
  keyPasses: number | null;
  dribblesAttempted: number | null;
  dribblesCompleted: number | null;
  dribbledPast: number | null;
  tacklesAttempted: number | null;
  blocks: number | null;
  interceptions: number | null;
  duelsTotal: number | null;
  duelsWon: number | null;
  foulsCommitted: number | null;
  foulsDrawn: number | null;
  yellowCards: number | null;
  redCards: number | null;
  offsides: number | null;
  penaltiesScored: number | null;
  penaltiesMissed: number | null;
  penaltiesWon: number | null;
  penaltiesCommitted: number | null;

  // Portero
  goalsConceded: number | null;
  saves: number | null;
  penaltiesSaved: number | null;

  /** Respuesta original del proveedor, para auditoría. */
  raw: unknown;
}

export interface ProviderInjury {
  playerExternalId: string;
  type: string | null;
  reason: string | null;
  fixtureExternalId: string | null;
  date: string | null;
}

export interface ProviderStandingRow {
  teamExternalId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: string | null;
}
