import { describe, expect, it } from 'vitest';
import { ApiFootballClient, ApiFootballProvider, InMemoryBudgetGuard } from '../src';

const envelope = (response: unknown[]) => ({
  errors: {},
  results: response.length,
  paging: { current: 1, total: 1 },
  response,
});

const noSleep = async () => {};

describe('API-Football formation grid', () => {
  it('reutiliza /fixtures/lineups y adjunta el grid a las stats sin requests extra', async () => {
    let calls = 0;
    const budget = new InMemoryBudgetGuard(10);
    const fetchFn: typeof fetch = (async (input) => {
      calls += 1;
      const url = new URL(String(input));

      if (url.pathname.endsWith('/fixtures/lineups')) {
        return new Response(JSON.stringify(envelope([
          {
            team: { id: 541 },
            startXI: [
              { player: { id: 762, number: 8, pos: 'M', grid: '3:2' } },
            ],
            substitutes: [],
          },
        ])), { status: 200 });
      }

      if (url.pathname.endsWith('/fixtures/players')) {
        return new Response(JSON.stringify(envelope([
          {
            team: { id: 541 },
            players: [
              {
                player: { id: 762 },
                statistics: [
                  {
                    games: { minutes: 90, position: 'M', rating: '7.2', captain: false },
                    goals: { total: 0, conceded: null, assists: 0, saves: null },
                    shots: { total: 1, on: 0 },
                    passes: { total: 50, key: 2, accuracy: '44' },
                    tackles: { total: 2, blocks: 0, interceptions: 1 },
                    duels: { total: 7, won: 4 },
                    dribbles: { attempts: 1, success: 1, past: 0 },
                    fouls: { drawn: 1, committed: 1 },
                    cards: { yellow: 0, red: 0 },
                    penalty: { won: null, commited: null, scored: 0, missed: 0, saved: null },
                    offsides: 0,
                  },
                ],
              },
            ],
          },
        ])), { status: 200 });
      }

      return new Response(JSON.stringify(envelope([])), { status: 200 });
    }) as typeof fetch;

    const provider = new ApiFootballProvider(new ApiFootballClient({
      apiKey: 'test',
      baseUrl: 'https://v3.football.api-sports.io',
      budget,
      fetchFn,
      sleepFn: noSleep,
    }));

    await provider.getLineups('123');
    const stats = await provider.getPlayerMatchStatistics('123');

    expect(stats).toHaveLength(1);
    expect((stats[0]!.raw as { formationGrid?: string }).formationGrid).toBe('3:2');
    expect(calls).toBe(2);
    expect(budget.usedToday).toBe(2);
  });

  it('mantiene null si el proveedor no publica grid', async () => {
    const budget = new InMemoryBudgetGuard(10);
    let call = 0;
    const fetchFn: typeof fetch = (async () => {
      call += 1;
      if (call === 1) {
        return new Response(JSON.stringify(envelope([
          {
            team: { id: 541 },
            startXI: [{ player: { id: 762, number: 8, pos: 'M', grid: null } }],
            substitutes: [],
          },
        ])), { status: 200 });
      }
      return new Response(JSON.stringify(envelope([
        {
          team: { id: 541 },
          players: [
            {
              player: { id: 762 },
              statistics: [
                {
                  games: { minutes: 90, position: 'M', rating: null, captain: false },
                  goals: { total: 0, conceded: null, assists: 0, saves: null },
                  shots: { total: 0, on: 0 },
                  passes: { total: 1, key: 0, accuracy: '1' },
                  tackles: { total: 0, blocks: 0, interceptions: 0 },
                  duels: { total: 0, won: 0 },
                  dribbles: { attempts: 0, success: 0, past: 0 },
                  fouls: { drawn: 0, committed: 0 },
                  cards: { yellow: 0, red: 0 },
                  penalty: { won: null, commited: null, scored: 0, missed: 0, saved: null },
                  offsides: 0,
                },
              ],
            },
          ],
        },
      ])), { status: 200 });
    }) as typeof fetch;

    const provider = new ApiFootballProvider(new ApiFootballClient({
      apiKey: 'test',
      baseUrl: 'https://v3.football.api-sports.io',
      budget,
      fetchFn,
      sleepFn: noSleep,
    }));

    await provider.getLineups('456');
    const stats = await provider.getPlayerMatchStatistics('456');
    expect((stats[0]!.raw as { formationGrid?: string | null }).formationGrid).toBeNull();
  });
});
