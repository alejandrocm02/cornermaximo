import { TRACKED_COMPETITIONS } from '@cornermaximo/shared';
import { describe, expect, it } from 'vitest';
import {
  ApiFootballClient,
  ApiFootballProvider,
  BudgetExceededError,
  InMemoryBudgetGuard,
  mapFixturePlayers,
  mapMatchStatus,
  mapStandings,
  mapTeam,
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

describe('presupuesto de requests (plan Pro, 7 500/día)', () => {
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

  it('reintenta errores de red, aplica timeout y contabiliza cada intento', async () => {
    let calls = 0;
    let receivedSignal: AbortSignal | null = null;
    const budget = new InMemoryBudgetGuard(100);
    const flakyFetch: typeof fetch = (async (_input, init) => {
      calls += 1;
      receivedSignal = init?.signal ?? null;
      if (calls === 1) throw new TypeError('network unavailable');
      return new Response(JSON.stringify(envelope([])), { status: 200 });
    }) as typeof fetch;

    const client = new ApiFootballClient({
      apiKey: 'test',
      baseUrl: 'https://v3.football.api-sports.io',
      budget,
      fetchFn: flakyFetch,
      sleepFn: noSleep,
      requestTimeoutMs: 50,
    });

    await expect(client.get('/teams')).resolves.toEqual([]);
    expect(calls).toBe(2);
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(budget.usedToday).toBe(2);
  });

  it('no permite que los reintentos sobrepasen el presupuesto', async () => {
    let calls = 0;
    const budget = new InMemoryBudgetGuard(1);
    const failingFetch: typeof fetch = (async () => {
      calls += 1;
      throw new TypeError('network unavailable');
    }) as typeof fetch;

    const client = new ApiFootballClient({
      apiKey: 'test',
      baseUrl: 'https://v3.football.api-sports.io',
      budget,
      fetchFn: failingFetch,
      sleepFn: noSleep,
    });

    await expect(client.get('/teams')).rejects.toBeInstanceOf(BudgetExceededError);
    expect(calls).toBe(1);
    expect(budget.usedToday).toBe(1);
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
  it('getCompetitions devuelve el catálogo configurado sin gastar requests', async () => {
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
    const comps = await provider.getCompetitions();
    expect(comps).toHaveLength(TRACKED_COMPETITIONS.length);
    expect(comps.map((c) => c.externalId)).toEqual(
      TRACKED_COMPETITIONS.map((competition) => String(competition.apiFootballId)),
    );
    expect(comps.map((c) => c.name)).toContain('LaLiga');
    expect(comps.find((c) => c.name === 'Copa Mundial de la FIFA 2026')?.type).toBe('CUP');
    expect(budget.usedToday).toBe(0);
  });
});

describe('mapTeam', () => {
  it('usa el país propio del equipo cuando el proveedor lo da (selecciones nacionales)', () => {
    const team = mapTeam(
      {
        team: { id: 1, name: 'Belgium', code: 'BEL', founded: 1895, logo: null, country: 'Belgium', national: true },
        venue: null,
      },
      'World', // país "de respaldo" de la competición (Mundial), no debe usarse si hay dato propio
    );
    expect(team.country).toBe('Belgium');
  });

  it('cae al país de respaldo si el proveedor no lo da', () => {
    const team = mapTeam(
      { team: { id: 541, name: 'Real Madrid', code: 'RMA', founded: 1902, logo: null }, venue: null },
      'Spain',
    );
    expect(team.country).toBe('Spain');
  });
});

describe('mapStandings', () => {
  it('recorre TODOS los grupos, no solo el primero (bug de fase de grupos)', () => {
    const raw = {
      league: {
        standings: [
          [
            { rank: 1, team: { id: 1 }, points: 6, group: 'Group A', all: { played: 2, win: 2, draw: 0, lose: 0, goals: { for: 4, against: 1 } }, form: 'WW' },
          ],
          [
            { rank: 1, team: { id: 2 }, points: 4, group: 'Group B', all: { played: 2, win: 1, draw: 1, lose: 0, goals: { for: 3, against: 2 } }, form: 'WD' },
          ],
        ],
      },
    };
    const rows = mapStandings(raw);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.group)).toEqual(['Group A', 'Group B']);
    expect(rows.map((r) => r.teamExternalId)).toEqual(['1', '2']);
  });

  it('liga de tabla única: un solo grupo, group = null si el proveedor no lo da', () => {
    const raw = {
      league: {
        standings: [
          [{ rank: 1, team: { id: 541 }, points: 90, all: { played: 38, win: 29, draw: 3, lose: 6, goals: { for: 85, against: 30 } }, form: 'WWWDW' }],
        ],
      },
    };
    const rows = mapStandings(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.group).toBeNull();
  });

  it('conserva el tercero en su grupo y descarta su duplicado de mejores terceros', () => {
    const third = {
      team: { id: 3 },
      points: 4,
      all: { played: 3, win: 1, draw: 1, lose: 1, goals: { for: 3, against: 3 } },
      form: 'WDL',
    };
    const raw = {
      league: {
        standings: [
          [
            { ...third, rank: 3, group: 'Group A' },
            { ...third, rank: 4, team: { id: 4 }, group: 'Group A' },
          ],
          [{ ...third, rank: 1, group: 'Group Stage' }],
        ],
      },
    };

    const rows = mapStandings(raw);

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.teamExternalId === '3')).toMatchObject({
      group: 'Group A',
      position: 3,
    });
  });
});
