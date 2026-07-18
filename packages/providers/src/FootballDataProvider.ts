/**
 * Capa de abstracción del proveedor de datos.
 * La aplicación SOLO habla con esta interfaz: cambiar de API
 * (API-Football -> Sportmonks -> Opta) = escribir un nuevo adaptador.
 */
import type {
  ProviderTransfer,
  ProviderCompetition,
  ProviderFixture,
  ProviderInjury,
  ProviderLineupEntry,
  ProviderPlayer,
  ProviderPlayerMatchStats,
  ProviderStandingRow,
  ProviderTeam,
} from './types';

export interface FootballDataProvider {
  /** Nombre único del proveedor ("api-football"). */
  readonly name: string;

  getCompetitions(): Promise<ProviderCompetition[]>;
  getTeamsByCompetition(competitionExternalId: string, season: number): Promise<ProviderTeam[]>;
  getPlayersByTeam(teamExternalId: string): Promise<ProviderPlayer[]>;
  getFixtures(competitionExternalId: string, season: number): Promise<ProviderFixture[]>;
  getLineups(fixtureExternalId: string): Promise<ProviderLineupEntry[]>;
  /** Estadísticas de TODOS los jugadores de un partido (campo y porteros). */
  getPlayerMatchStatistics(fixtureExternalId: string): Promise<ProviderPlayerMatchStats[]>;
  getInjuries(competitionExternalId: string, season: number): Promise<ProviderInjury[]>;
  getStandings(competitionExternalId: string, season: number): Promise<ProviderStandingRow[]>;
  /** Traspasos registrados de un equipo (histórico completo del proveedor). */
  getTransfers(teamExternalId: string): Promise<ProviderTransfer[]>;
}

/** Control de presupuesto diario de requests (plan Pro: 7 500/día). */
export interface RequestBudgetGuard {
  /** true si quedan al menos `n` requests disponibles hoy. */
  canSpend(n: number): Promise<boolean>;
  /** Registra `n` requests consumidas. */
  record(n: number): Promise<void>;
}

/** Guard en memoria: útil para tests y desarrollo. En producción se respalda en BD. */
export class InMemoryBudgetGuard implements RequestBudgetGuard {
  private used = 0;
  constructor(private readonly dailyLimit: number) {}

  async canSpend(n: number): Promise<boolean> {
    return this.used + n <= this.dailyLimit;
  }
  async record(n: number): Promise<void> {
    this.used += n;
  }
  get usedToday(): number {
    return this.used;
  }
}

export class BudgetExceededError extends Error {
  constructor() {
    super('Presupuesto diario de requests agotado; el job se reintentará mañana.');
    this.name = 'BudgetExceededError';
  }
}

export class ProviderHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message?: string,
  ) {
    super(message ?? `Provider HTTP ${status} en ${url}`);
    this.name = 'ProviderHttpError';
  }
}
