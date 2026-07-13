/**
 * Adaptador de API-Football que implementa FootballDataProvider.
 * Coste en requests (plan gratuito 100/día):
 *  - getCompetitions: 0 (los ids de las 5 ligas son constantes conocidas)
 *  - getTeamsByCompetition: 1
 *  - getPlayersByTeam: 1 (endpoint /players/squads)
 *  - getFixtures: 1 por liga/temporada
 *  - getLineups: 1 por partido
 *  - getPlayerMatchStatistics: 1 por partido (todos los jugadores de golpe)
 *  - getInjuries / getStandings: 1 por liga
 */
import { BIG_FIVE_LEAGUES } from '@futstats/shared';
import type { FootballDataProvider } from '../FootballDataProvider';
import type {
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
  mapFixture,
  mapFixturePlayers,
  mapInjury,
  mapLineups,
  mapSquadPlayer,
  mapStandings,
  mapTeam,
} from './mappers';

export class ApiFootballProvider implements FootballDataProvider {
  readonly name = 'api-football';

  constructor(private readonly client: ApiFootballClient) {}

  async getCompetitions(season: number): Promise<ProviderCompetition[]> {
    // Las 5 grandes ligas son fijas: 0 requests gastadas.
    return BIG_FIVE_LEAGUES.map((l) => ({
      externalId: String(l.apiFootballId),
      name: l.name,
      country: l.country,
      logoUrl: null,
      season,
    }));
  }

  async getTeamsByCompetition(competitionExternalId: string, season: number): Promise<ProviderTeam[]> {
    const league = BIG_FIVE_LEAGUES.find((l) => String(l.apiFootballId) === competitionExternalId);
    const raws = await this.client.get<Parameters<typeof mapTeam>[0]>('/teams', {
      league: competitionExternalId,
      season,
    });
    return raws.map((raw) => mapTeam(raw, league?.country ?? 'Unknown'));
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
}
