/**
 * Tests de las actas: un jugador que figura en la alineación pero todavía no
 * está en ninguna plantilla sincronizada (fichaje reciente, canterano) debe
 * darse de alta, no desaparecer de la alineación y de sus estadísticas.
 */
import { describe, expect, it } from 'vitest';
import type { FootballDataProvider, ProviderLineupEntry, ProviderPlayerMatchStats } from '@cornermaximo/providers';
import { syncMatchStats } from '../src/services';

interface JugadorFalso {
  id: number;
  externalId: string;
  fullName: string;
  slug: string;
  currentTeamId: number | null;
}

function crearDb(jugadores: JugadorFalso[], equipos: Array<{ id: number; externalId: string; isNational: boolean }>) {
  const alineacion: Array<{ playerId: number; teamId: number; role: string; minutesPlayed: number }> = [];
  const estadisticas: number[] = [];
  const posiciones: Array<{ playerId: number; group: string }> = [];
  let siguienteId = 1000;

  const db = {
    player: {
      findMany: async ({ where }: { where: { externalId: { in: string[] } } }) =>
        jugadores.filter((j) => where.externalId.in.includes(j.externalId)),
      findUnique: async ({ where }: { where: { slug?: string } }) =>
        jugadores.find((j) => j.slug === where.slug) ?? null,
      upsert: async ({
        where,
        create,
      }: {
        where: { providerId_externalId: { externalId: string } };
        create: Omit<JugadorFalso, 'id'>;
      }) => {
        const existente = jugadores.find((j) => j.externalId === where.providerId_externalId.externalId);
        if (existente != null) return existente;
        const nuevo = { ...create, id: siguienteId++ };
        jugadores.push(nuevo);
        return nuevo;
      },
    },
    playerPosition: {
      upsert: async ({ create }: { create: { playerId: number; group: string } }) => {
        posiciones.push({ playerId: create.playerId, group: create.group });
      },
    },
    team: { findMany: async () => equipos },
    matchPlayer: {
      upsert: async ({ create }: { create: { playerId: number; teamId: number; role: string; minutesPlayed: number } }) => {
        alineacion.push(create);
        return { id: create.playerId };
      },
    },
    playerMatchStatistics: {
      upsert: async ({ where }: { where: { matchPlayerId: number } }) => {
        estadisticas.push(where.matchPlayerId);
      },
    },
    goalkeeperMatchStatistics: { upsert: async () => {} },
  };
  return { db, jugadores, alineacion, estadisticas, posiciones };
}

const entrada = (id: string, nombre: string | null, equipo = '85'): ProviderLineupEntry => ({
  playerExternalId: id,
  playerName: nombre,
  teamExternalId: equipo,
  role: 'STARTER',
  positionPlayed: 'M',
  shirtNumber: 8,
});

const stats = (id: string, equipo = '85'): ProviderPlayerMatchStats =>
  ({ playerExternalId: id, teamExternalId: equipo, isGoalkeeper: false, minutes: 90, rating: 7, isCaptain: false, positionPlayed: 'M', raw: {} }) as unknown as ProviderPlayerMatchStats;

const proveedor = (lineups: ProviderLineupEntry[], playerStats: ProviderPlayerMatchStats[]) =>
  ({ getLineups: async () => lineups, getPlayerMatchStatistics: async () => playerStats }) as unknown as FootballDataProvider;

describe('syncMatchStats', () => {
  it('da de alta a un jugador del acta que aún no existe y registra sus estadísticas', async () => {
    const { db, jugadores, alineacion, estadisticas, posiciones } = crearDb(
      [{ id: 1, externalId: '10', fullName: 'Conocido', slug: 'conocido', currentTeamId: 50 }],
      [{ id: 50, externalId: '85', isNational: false }],
    );

    const procesados = await syncMatchStats(
      db as never,
      proveedor([entrada('10', 'Conocido'), entrada('99', 'Nuevo Fichaje')], [stats('10'), stats('99')]),
      1,
      7,
      '1001',
    );

    const nuevo = jugadores.find((j) => j.externalId === '99');
    expect(nuevo).toMatchObject({ fullName: 'Nuevo Fichaje', slug: 'nuevo-fichaje', currentTeamId: 50 });
    expect(alineacion.map((a) => a.playerId)).toEqual([1, nuevo!.id]);
    expect(estadisticas).toEqual([1, nuevo!.id]);
    expect(posiciones).toEqual([{ playerId: nuevo!.id, group: 'MF' }]);
    expect(procesados).toBe(2);
  });

  it('no asigna club cuando el acta es de una selección nacional', async () => {
    const { db, jugadores } = crearDb([], [{ id: 60, externalId: '9', isNational: true }]);
    await syncMatchStats(db as never, proveedor([entrada('77', 'Internacional', '9')], [stats('77', '9')]), 1, 7, '1002');
    expect(jugadores[0]).toMatchObject({ externalId: '77', currentTeamId: null });
  });

  it('omite a un desconocido si el acta no trae su nombre', async () => {
    const { db, jugadores, alineacion } = crearDb([], [{ id: 50, externalId: '85', isNational: false }]);
    await syncMatchStats(db as never, proveedor([entrada('55', null)], [stats('55')]), 1, 7, '1003');
    expect(jugadores).toHaveLength(0);
    expect(alineacion).toHaveLength(0);
  });
});
