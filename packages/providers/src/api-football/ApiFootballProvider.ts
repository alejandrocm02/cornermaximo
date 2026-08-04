/**
 * Adaptador de API-Football que implementa FootballDataProvider.
 * Coste en requests (plan Pro, 7 500/día):
 *  - getCompetitions: 0 (el catálogo rastreado y sus logos se derivan de ids estables)
 *  - getTeamsByCompetition: 1
 *  - getPlayersByTeam: 1 (endpoint /players/squads)
 *  - getFixtures: 1 por competición/temporada
 *  - getLineups: 1 por partido
 *  - getPlayerMatchStatistics: 1 por partido (todos los jugadores de golpe)
 *  - getInjuries / getStandings: 1 por competición/temporada
 */
import { TRACKED_COMPETITIONS } from '@futstats/shared';
import type { FootballDataProvider } from '../FootballDataProvider';
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
} from '../types';
import type { ApiFootballClient } from './client';
import {
  mapTransfers,
  mapFixture,
  mapFixturePlayers,
  mapInjury,
  mapLineups,
  mapSquadPlayer,
  mapStandings,
  mapTeam,
} from './mappers';

function competitionLogoUrl(apiFootballId: number): string {
  return `https://media.api-sports.io/football/leagues/${apiFootballId}.png`;
}

export class ApiFootballProvider implements FootballDataProvider {
  readonly name = 'api-football';

  constructor(private readonly client: ApiFootballClient) {}

  async getCompetitions(): Promise<ProviderCompetition[]> {
    // Los ids de competición son estables y permiten construir el logo sin gastar requests.
    return TRACKED_COMPETITIONS.map((c) => ({
      externalId: String(c.apiFootballId),
      name: c.name,
      country: c.country,
      logoUrl: competitionLogoUrl(c.apiFootballId),
      type: c.type,
    }));
  }

  async getTeamsByCompetition(competitionExternalId: string, season: number): Promise<ProviderTeam[]> {
    const competition = TRACKED_COMPETITIONS.find((c) => String(c.apiFootballId) === competitionExternalId);
    const raws = await this.client.get<Parameters<typeof mapTeam>[0]>('/teams', {
      league: competitionExternalId,
      season,
    });
    return raws.map((raw) => mapTeam(raw, competition?.country ?? 'Unknown'));
  }

  async getPlayersByTeam(teamExternalId: string): Promise<ProviderPlayer[]> {
    const raws = await this.client.get<{ players: Parameters<typeof mapSquadPlayer>[0][] }>(
      '/players/squads',
      { team: teamExternalId },
    );
    return (raws[0]?.players ?? []).map(mapSquadPlayer);
  }

  async getFixtures(competitionExternalId: string, season: number): Promise<ProviderFixture[]> {
    const raws = await this.client.get<Parameters<typeof mapFixture>[0]>('/fixtures', {
      league: competitionExternalId,
      season,
    });
    return raws.map(mapFixture);
  }

  async getLineups(fixtureExternalId: string): Promise<ProviderLineupEntry[]> {
    const raws = await this.client.get<Parameters<typeof mapLineups>[0][number]>(
      '/fixtures/lineups',
      { fixture: fixtureExternalId },
    );
    return mapLineups(raws);
  }

  async getPlayerMatchStatistics(fixtureExternalId: string): Promise<ProviderPlayerMatchStats[]> {
    const raws = await this.client.get<Parameters<typeof mapFixturePlayers>[0][number]>(
      '/fixtures/players',
      { fixture: fixtureExternalId },
    );
    return mapFixturePlayers(raws);
  }

  async getInjuries(competitionExternalId: string, season: number): Promise<ProviderInjury[]> {
    const raws = await this.client.get<Parameters<typeof mapInjury>[0]>('/injuries', {
      league: competitionExternalId,
      season,
    });
    return raws.map(mapInjury);
  }

  async getStandings(competitionExternalId: string, season: number): Promise<ProviderStandingRow[]> {
    const raws = await this.client.get<Parameters<typeof mapStandings>[0]>('/standings', {
      league: competitionExternalId,
      season,
    });
    return raws[0] != null ? mapStandings(raws[0]) : [];
  }

  async getTransfers(teamExternalId: string): Promise<ProviderTransfer[]> {
    const raws = await this.client.get<Parameters<typeof mapTransfers>[0][number]>('/transfers', {
      team: teamExternalId,
    });
    return mapTransfers(raws);
  }
}
