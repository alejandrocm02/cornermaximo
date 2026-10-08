/**
 * Tests de los eventos del partido: la sincronización programada debe guardar
 * goles, tarjetas y cambios aunque nadie haya seguido el encuentro en directo.
 */
import { describe, expect, it } from 'vitest';
import { mapFixtureEvents, type FootballDataProvider, type ProviderMatchEvent } from '@cornermaximo/providers';
import { syncMatchEvents } from '../src/services';

type EventoGuardado = { matchId: number; playerId: number | null; assistPlayerId: number | null; type: string; minute: number };

function crearDb(jugadores: Array<{ id: number; externalId: string }>, guardados: EventoGuardado[] = []) {
  const eventos = [...guardados];
  const tx = {
    matchEvent: {
      deleteMany: async ({ where }: { where: { matchId: number } }) => {
        for (let i = eventos.length - 1; i >= 0; i--) if (eventos[i]!.matchId === where.matchId) eventos.splice(i, 1);
      },
      createMany: async ({ data }: { data: EventoGuardado[] }) => {
        eventos.push(...data);
      },
    },
  };
  const db = {
    player: {
      findMany: async ({ where }: { where: { externalId: { in: string[] } } }) =>
        jugadores.filter((j) => where.externalId.in.includes(j.externalId)),
    },
    $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx),
  };
  return { db, eventos };
}

const proveedor = (events: ProviderMatchEvent[]) =>
  ({ getMatchEvents: async () => events }) as unknown as FootballDataProvider;

const gol = (minute: number, player: string | null, assist: string | null = null): ProviderMatchEvent => ({
  teamExternalId: '85',
  playerExternalId: player,
  assistExternalId: assist,
  type: 'GOAL',
  minute,
  extraMinute: null,
  detail: 'Normal Goal',
});

describe('syncMatchEvents', () => {
  it('guarda los eventos y enlaza a los jugadores conocidos', async () => {
    const { db, eventos } = crearDb([{ id: 1, externalId: '10' }]);

    const guardados = await syncMatchEvents(db as never, proveedor([gol(12, '10', '99'), gol(80, null)]), 1, 7, '1001');

    expect(guardados).toBe(2);
    expect(eventos).toMatchObject([
      { matchId: 7, playerId: 1, assistPlayerId: null, type: 'GOAL', minute: 12 },
      { matchId: 7, playerId: null, assistPlayerId: null, type: 'GOAL', minute: 80 },
    ]);
  });

  it('sustituye los eventos anteriores del mismo partido sin tocar los de otros', async () => {
    const { db, eventos } = crearDb(
      [],
      [
        { matchId: 7, playerId: null, assistPlayerId: null, type: 'YELLOW_CARD', minute: 5 },
        { matchId: 8, playerId: null, assistPlayerId: null, type: 'GOAL', minute: 30 },
      ],
    );

    await syncMatchEvents(db as never, proveedor([gol(12, null)]), 1, 7, '1001');

    expect(eventos.map((e) => [e.matchId, e.type, e.minute])).toEqual([
      [8, 'GOAL', 30],
      [7, 'GOAL', 12],
    ]);
  });

  it('conserva lo guardado si el proveedor responde sin eventos', async () => {
    const { db, eventos } = crearDb([], [{ matchId: 7, playerId: null, assistPlayerId: null, type: 'GOAL', minute: 12 }]);

    const guardados = await syncMatchEvents(db as never, proveedor([]), 1, 7, '1001');

    expect(guardados).toBe(0);
    expect(eventos).toHaveLength(1);
  });
});

describe('mapFixtureEvents', () => {
  const crudo = (type: string, detail: string | null, elapsed: number | null = 10) => ({
    time: { elapsed, extra: null },
    team: { id: 85 },
    player: { id: 10, name: 'Jugador' },
    assist: { id: null, name: null },
    type,
    detail,
    comments: null,
  });

  it('clasifica goles, tarjetas, cambios y VAR', () => {
    const tipos = mapFixtureEvents([
      crudo('Goal', 'Normal Goal'),
      crudo('Goal', 'Penalty'),
      crudo('Goal', 'Missed Penalty'),
      crudo('Goal', 'Own Goal'),
      crudo('Card', 'Yellow Card'),
      crudo('Card', 'Second Yellow card'),
      crudo('Card', 'Red Card'),
      crudo('subst', 'Substitution 1'),
      crudo('Var', 'Goal cancelled'),
    ]).map((e) => e.type);

    expect(tipos).toEqual([
      'GOAL',
      'PENALTY_GOAL',
      'MISSED_PENALTY',
      'OWN_GOAL',
      'YELLOW_CARD',
      'SECOND_YELLOW',
      'RED_CARD',
      'SUBSTITUTION',
      'VAR',
    ]);
  });

  it('descarta eventos sin minuto o de tipo desconocido', () => {
    expect(mapFixtureEvents([crudo('Goal', 'Normal Goal', null), crudo('Otro', null)])).toEqual([]);
  });

  it('convierte los ids a texto y deja null los ausentes', () => {
    expect(mapFixtureEvents([crudo('Goal', 'Normal Goal')])[0]).toMatchObject({
      teamExternalId: '85',
      playerExternalId: '10',
      assistExternalId: null,
      minute: 10,
      detail: 'Normal Goal',
    });
  });
});
