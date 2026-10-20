/**
 * Tests del calendario: el proveedor puede invertir local y visitante de un
 * partido ya registrado (cambio de sede). La base de datos impone
 * @@unique([matchId, teamId]) y @@unique([matchId, isHome]); el doble en
 * memoria aplica ambas para reproducir el fallo real que bloqueaba la Ligue 1.
 */
import { describe, expect, it } from 'vitest';
import type { FootballDataProvider, ProviderFixture } from '@cornermaximo/providers';
import { syncFixtures, syncTeams } from '../src/services';

interface FilaEquipo {
  matchId: number;
  teamId: number;
  isHome: boolean;
  goals: number | null;
  penaltyGoals: number | null;
}

function crearDb(filasIniciales: FilaEquipo[]) {
  const filas = [...filasIniciales];
  const unicidad = (fila: FilaEquipo, ignorar?: FilaEquipo) => {
    for (const otra of filas) {
      if (otra === ignorar || otra.matchId !== fila.matchId) continue;
      if (otra.teamId === fila.teamId || otra.isHome === fila.isHome) {
        throw new Error('Unique constraint failed on the fields: (`matchId`,`teamId`)');
      }
    }
  };

  const db = {
    competition: {
      findUniqueOrThrow: async () => ({ name: 'Ligue 1', seasons: [{ id: 1 }] }),
    },
    team: {
      findMany: async () => [
        { id: 10, externalId: '85' },
        { id: 20, externalId: '91' },
      ],
    },
    match: {
      upsert: async () => ({
        id: 1,
        teams: filas.filter((f) => f.matchId === 1).map(({ isHome, teamId }) => ({ isHome, teamId })),
      }),
    },
    matchTeam: {
      deleteMany: async ({ where }: { where: { matchId: number } }) => {
        for (let i = filas.length - 1; i >= 0; i--) if (filas[i]!.matchId === where.matchId) filas.splice(i, 1);
      },
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { matchId_isHome: { matchId: number; isHome: boolean } };
        update: Partial<FilaEquipo>;
        create: FilaEquipo;
      }) => {
        const actual = filas.find(
          (f) => f.matchId === where.matchId_isHome.matchId && f.isHome === where.matchId_isHome.isHome,
        );
        if (actual != null) {
          const siguiente = { ...actual, ...update };
          unicidad(siguiente, actual);
          Object.assign(actual, update);
        } else {
          unicidad(create);
          filas.push({ ...create });
        }
      },
    },
  };
  return { db, filas };
}

function proveedor(fixture: Partial<ProviderFixture>): FootballDataProvider {
  return {
    getFixtures: async () => [
      {
        externalId: '1001',
        competitionExternalId: '61',
        season: 2026,
        round: 'Regular Season - 5',
        kickoffAt: '2026-10-04T15:00:00Z',
        status: 'SCHEDULED',
        homeTeamExternalId: '85',
        awayTeamExternalId: '91',
        homeGoals: null,
        awayGoals: null,
        homePenaltyGoals: null,
        awayPenaltyGoals: null,
        hasExtraTime: false,
        hasPenalties: false,
        ...fixture,
      } as ProviderFixture,
    ],
  } as unknown as FootballDataProvider;
}

describe('syncFixtures', () => {
  it('actualiza un partido cuyos lados no cambian', async () => {
    const { db, filas } = crearDb([
      { matchId: 1, teamId: 10, isHome: true, goals: null, penaltyGoals: null },
      { matchId: 1, teamId: 20, isHome: false, goals: null, penaltyGoals: null },
    ]);
    await syncFixtures(db as never, proveedor({ homeGoals: 2, awayGoals: 1 }), 1, '61', 2026);
    expect(filas).toEqual([
      { matchId: 1, teamId: 10, isHome: true, goals: 2, penaltyGoals: null },
      { matchId: 1, teamId: 20, isHome: false, goals: 1, penaltyGoals: null },
    ]);
  });

  it('acepta que el proveedor invierta local y visitante', async () => {
    const { db, filas } = crearDb([
      { matchId: 1, teamId: 10, isHome: true, goals: null, penaltyGoals: null },
      { matchId: 1, teamId: 20, isHome: false, goals: null, penaltyGoals: null },
    ]);
    await syncFixtures(
      db as never,
      proveedor({ homeTeamExternalId: '91', awayTeamExternalId: '85' }),
      1,
      '61',
      2026,
    );
    expect(filas.find((f) => f.isHome)?.teamId).toBe(20);
    expect(filas.find((f) => !f.isHome)?.teamId).toBe(10);
    expect(filas).toHaveLength(2);
  });

  it('en la Champions descarta las rondas previas', async () => {
    const { db, filas } = crearDb([]);
    const resultado = await syncFixtures(
      db as never,
      proveedor({ competitionExternalId: '2', round: '2nd Qualifying Round' }),
      1,
      '2',
      2026,
    );
    expect(resultado).toBe(0);
    expect(filas).toHaveLength(0);
  });

  it('en la Champions guarda la fase de liga', async () => {
    const { db, filas } = crearDb([]);
    const resultado = await syncFixtures(
      db as never,
      proveedor({ competitionExternalId: '2', round: 'League Stage - 3' }),
      1,
      '2',
      2026,
    );
    expect(resultado).toBe(1);
    expect(filas).toHaveLength(2);
  });
});

describe('syncTeams en competiciones con fase principal', () => {
  function dbEquipos() {
    const creados: string[] = [];
    const db = {
      competition: { findUniqueOrThrow: async () => ({ name: 'UEFA Champions League', seasons: [{ id: 7 }] }) },
      country: { upsert: async () => ({ id: 1 }) },
      stadium: { findFirst: async () => null, create: async () => ({ id: 1 }) },
      team: {
        findUnique: async () => null,
        upsert: async ({ create }: { create: { externalId: string } }) => {
          creados.push(create.externalId);
          return { id: creados.length };
        },
      },
      seasonTeam: { upsert: async () => ({}) },
    };
    return { db, creados };
  }

  const equipo = (id: string) => ({
    externalId: id,
    name: `Equipo ${id}`,
    shortName: null,
    crestUrl: null,
    founded: null,
    country: 'Spain',
    isNational: false,
    stadiumName: null,
    stadiumCity: null,
    stadiumCapacity: null,
  });

  const partido = (round: string, home: string, away: string) =>
    ({ externalId: `${home}-${away}`, round, homeTeamExternalId: home, awayTeamExternalId: away }) as ProviderFixture;

  it('solo crea los equipos que juegan la fase principal', async () => {
    const { db, creados } = dbEquipos();
    const provider = {
      getTeamsByCompetition: async () => [equipo('541'), equipo('529'), equipo('9999')],
      getFixtures: async () => [partido('League Stage - 1', '541', '529'), partido('1st Qualifying Round', '9999', '8888')],
    } as unknown as FootballDataProvider;

    const total = await syncTeams(db as never, provider, 1, '2', 2026);

    expect(total).toBe(2);
    expect(creados).toEqual(['541', '529']);
  });

  it('falla con las rondas recibidas si no reconoce ninguna', async () => {
    const { db, creados } = dbEquipos();
    const provider = {
      getTeamsByCompetition: async () => [equipo('541')],
      getFixtures: async () => [partido('Group Stage - 1', '541', '529')],
    } as unknown as FootballDataProvider;

    await expect(syncTeams(db as never, provider, 1, '2', 2026)).rejects.toThrow(/Rondas recibidas: Group Stage - 1/);
    expect(creados).toEqual([]);
  });

  it('en una liga no consulta el calendario', async () => {
    const { db, creados } = dbEquipos();
    let consultas = 0;
    const provider = {
      getTeamsByCompetition: async () => [equipo('541'), equipo('529')],
      getFixtures: async () => {
        consultas++;
        return [];
      },
    } as unknown as FootballDataProvider;

    await syncTeams(db as never, provider, 1, '140', 2026);

    expect(consultas).toBe(0);
    expect(creados).toEqual(['541', '529']);
  });
});
