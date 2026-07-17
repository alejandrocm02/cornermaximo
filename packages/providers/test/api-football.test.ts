import { describe, expect, it } from 'vitest';
import {
  ApiFootballClient,
  ApiFootballProvider,
  BudgetExceededError,
  InMemoryBudgetGuard,
  mapFixturePlayers,
  mapMatchStatus,
} from '../src';

/** fetch simulado: responde con un envelope de API-Football. */
function fakeFetch(response: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(response), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

const envelope = (response: unknown[]) => ({
  errors: {},
  results: response.length,
  paging: { current: 1, total: 1 },
  response,
});

const noSleep = async () => {};

function makeClient(response: unknown[], budget = new InMemoryBudgetGuard(100)) {
  return {
    client: new ApiFootballClient({
      apiKey: 'test',
      baseUrl: 'https://v3.football.api-sports.io',
      budget,
      fetchFn: fakeFetch(envelope(response)),
      sleepFn: noSleep,
    }),
    budget,
  };
}

describe('presupuesto de requests', () => {
  it('bloquea cuando el presupuesto está agotado', async () => {
    const { client } = makeClient([], new InMemoryBudgetGuard(0));
    await expect(client.get('/teams', { league: 140, season: 2026 })).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
  });

  it('registra el consumo por request', async () => {
    const { client, budget } = makeClient([]);
    await client.get('/teams', { league: 140, season: 2026 });
    expect(budget.usedToday).toBe(1);
  });

  it('acepta la URL base sin protocolo', async () => {
    let requestedUrl = '';
    const client = new ApiFootballClient({
      apiKey: 'test',
      baseUrl: 'v3.football.api-sports.io',
      budget: new InMemoryBudgetGuard(100),
      fetchFn: (async (url: Parameters<typeof fetch>[0]) => {
        requestedUrl = String(url);
        return new Response(JSON.stringify(envelope([])), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }) as unknown as typeof fetch,
      sleepFn: noSleep,
    });

    await client.get('/teams', { league: 140, season: 2026 });
    expect(requestedUrl).toContain('https://v3.football.api-sports.io/teams');
  });
});

describe('errores del proveedor', () => {
  it('errores lógicos con HTTP 200 lanzan excepción', async () => {
    const client = new ApiFootballClient({
      apiKey: 'test',
      baseUrl: 'https://v3.football.api-sports.io',
      budget: new InMemoryBudgetGuard(100),
      fetchFn: fakeFetch({ errors: { token: 'Invalid API key' }, results: 0, paging: { current: 1, total: 1 }, response: [] }),
      sleepFn: noSleep,
    });
    await expect(client.get('/teams', {})).rejects.toThrow('Invalid API key');
  });

  it('4xx no transitorio no se reintenta', async () => {
    let calls = 0;
    const countingFetch: typeof fetch = (async () => {
      calls++;
      return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;

    const client = new ApiFootballClient({
      apiKey: 'test',
      baseUrl: 'https://v3.football.api-sports.io',
      budget: new InMemoryBudgetGuard(100),
      fetchFn: countingFetch,
      sleepFn: noSleep,
    });
    await expect(client.get('/x', {})).rejects.toThrow();
    expect(calls).toBe(1);
  });
});

describe('mapMatchStatus', () => {
  it('mapea estados conocidos', () => {
    expect(mapMatchStatus('FT')).toBe('FINISHED');
    expect(mapMatchStatus('PST')).toBe('POSTPONED');
    expect(mapMatchStatus('ABD')).toBe('ABANDONED');
    expect(mapMatchStatus('1H')).toBe('LIVE');
  });
  it('estado desconocido => SCHEDULED (conservador)', () => {
    expect(mapMatchStatus('???')).toBe('SCHEDULED');
  });
});

describe('mapFixturePlayers', () => {
  const rawStats = (position: string, overrides: Record<string, unknown> = {}) => [
    {
      team: { id: 541 },
      players: [
        {
          player: { id: 762 },
          statistics: [
            {
              games: { minutes: 90, position, rating: '7.4', captain: false },
              goals: { total: 1, conceded: position === 'G' ? 2 : null, assists: null, saves: position === 'G' ? 5 : null },
              shots: { total: 3, on: 2 },
              passes: { total: 40, key: 2, accuracy: '35' },
              tackles: { total: 1, blocks: null, interceptions: 2 },
              duels: { total: 10, won: 6 },
              dribbles: { attempts: 4, success: 3, past: null },
              fouls: { drawn: 1, committed: 2 },
              cards: { yellow: 1, red: 0 },
              penalty: { won: null, commited: null, scored: 0, missed: 0, saved: position === 'G' ? 1 : null },
              offsides: null,
              ...overrides,
            },
          ],
        },
      ],
    },
  ];

  it('jugador de campo: métricas de campo, sin métricas de portero', () => {
    const [stats] = mapFixturePlayers(rawStats('M') as never);
    expect(stats!.isGoalkeeper).toBe(false);
    expect(stats!.goals).toBe(1);
    expect(stats!.passesCompleted).toBe(35); // passes.accuracy es un contador, no %
    expect(stats!.rating).toBe(7.4);
    expect(stats!.goalsConceded).toBeNull();
    expect(stats!.saves).toBeNull();
  });

  it('portero: incluye paradas y goles encajados', () => {
    const [stats] = mapFixturePlayers(rawStats('G') as never);
    expect(stats!.isGoalkeeper).toBe(true);
    expect(stats!.saves).toBe(5);
    expect(stats!.goalsConceded).toBe(2);
    expect(stats!.penaltiesSaved).toBe(1);
  });

  it('dato ausente => null, nunca 0', () => {
    const [stats] = mapFixturePlayers(rawStats('M') as never);
    expect(stats!.offsides).toBeNull();
    expect(stats!.dribbledPast).toBeNull();
  });
});

describe('ApiFootballProvider', () => {
  it('getCompetitions devuelve competiciones fijas sin gastar requests', async () => {
    const budget = new InMemoryBudgetGuard(0); // presupuesto agotado a propósito
    const provider = new ApiFootballProvider(
      new ApiFootballClient({
        apiKey: 'test',
        baseUrl: 'https://v3.football.api-sports.io',
        budget,
        fetchFn: fakeFetch(envelope([])),
        sleepFn: noSleep,
      }),
    );
    const comps = await provider.getCompetitions(2026);
    expect(comps).toHaveLength(6);
    expect(comps.map((c) => c.name)).toContain('LaLiga');
    expect(comps.map((c) => c.name)).toContain('Mundial 2026');
    expect(budget.usedToday).toBe(0);
  });

  it('no incluye el Mundial fuera de la temporada 2026', async () => {
    const { client } = makeClient([]);
    const provider = new ApiFootballProvider(client);
    const comps = await provider.getCompetitions(2025);
    expect(comps).toHaveLength(5);
    expect(comps.map((c) => c.name)).not.toContain('Mundial 2026');
  });
});
