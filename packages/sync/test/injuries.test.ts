/**
 * Tests de la reconciliación de lesiones.
 *
 * El proveedor devuelve el histórico de la temporada completa en cada llamada,
 * así que la corrección depende de dos cosas: filtrar por ventana de vigencia
 * y dar de alta a quien ya no tiene parte reciente. Sin la segunda, el estado
 * del jugador se vuelve un pestillo de un solo sentido.
 *
 * Se usa un doble de Prisma en memoria: basta con las operaciones que toca
 * `syncInjuries` y evita necesitar una base de datos real.
 */
import { describe, expect, it } from 'vitest';
import { syncInjuries } from '../src/services';

type Estado = 'AVAILABLE' | 'INJURED' | 'DOUBT' | 'SUSPENDED' | 'NOT_CALLED';

interface JugadorFalso {
  id: number;
  externalId: string;
  status: Estado;
  manuallyEdited: boolean;
  enCompeticion: boolean;
}

interface LesionFalsa {
  playerId: number;
  type: string | null;
  startDate: Date;
  resolvedAt: Date | null;
}

const DIA = 86_400_000;
const hace = (dias: number): Date => new Date(Date.now() - dias * DIA);

/** Doble mínimo de PrismaClient con solo lo que usa syncInjuries. */
function crearDb(jugadores: JugadorFalso[], lesiones: LesionFalsa[] = []) {
  const coincide = (row: LesionFalsa, where: Record<string, unknown>): boolean => {
    if (where.playerId != null) {
      const p = where.playerId as number | { in: number[] };
      if (typeof p === 'number' ? row.playerId !== p : !p.in.includes(row.playerId)) return false;
    }
    if (where.resolvedAt !== undefined) {
      const r = where.resolvedAt as null | { not: null };
      if (r === null && row.resolvedAt !== null) return false;
      if (r !== null && row.resolvedAt === null) return false;
    }
    if (where.startDate != null) {
      const s = where.startDate as { gte: Date };
      if (row.startDate < s.gte) return false;
    }
    return true;
  };

  return {
    jugadores,
    lesiones,
    player: {
      findUnique: async ({ where }: { where: { providerId_externalId: { externalId: string } } }) =>
        jugadores.find((j) => j.externalId === where.providerId_externalId.externalId) ?? null,
      findMany: async () => jugadores.filter((j) => j.enCompeticion).map((j) => ({ id: j.id })),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: { status: Estado } }) => {
        for (const j of jugadores) {
          if (where.id != null) {
            const w = where.id as number | { in: number[] };
            if (typeof w === 'number' ? j.id !== w : !w.in.includes(j.id)) continue;
          }
          if (where.manuallyEdited === false && j.manuallyEdited) continue;
          if (where.status != null) {
            const s = where.status as { in: Estado[] };
            if (!s.in.includes(j.status)) continue;
          }
          j.status = data.status;
        }
        return { count: 0 };
      },
    },
    injury: {
      findFirst: async ({ where }: { where: { playerId: number; startDate: Date; type: string | null } }) =>
        lesiones.find(
          (l) =>
            l.playerId === where.playerId &&
            l.startDate.getTime() === where.startDate.getTime() &&
            l.type === where.type,
        ) ?? null,
      create: async ({ data }: { data: { playerId: number; type: string | null; startDate: Date } }) => {
        lesiones.push({ playerId: data.playerId, type: data.type, startDate: data.startDate, resolvedAt: null });
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: { resolvedAt: Date | null };
      }) => {
        for (const l of lesiones) if (coincide(l, where)) l.resolvedAt = data.resolvedAt;
        return { count: 0 };
      },
    },
  };
}

/** Doble del proveedor: devuelve los partes indicados. */
function crearProveedor(partes: Array<{ playerExternalId: string; type: string | null; date: string | null }>) {
  return {
    getInjuries: async () =>
      partes.map((p) => ({ ...p, reason: null, fixtureExternalId: null })),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- dobles de prueba */
const ejecutar = (db: any, provider: any) => syncInjuries(db, provider, 1, '140', 2025);

describe('syncInjuries', () => {
  it('marca como lesionado a quien tiene un parte reciente', async () => {
    const db = crearDb([{ id: 1, externalId: 'p1', status: 'AVAILABLE', manuallyEdited: false, enCompeticion: true }]);
    const provider = crearProveedor([{ playerExternalId: 'p1', type: 'Muscle Injury', date: hace(2).toISOString() }]);

    await ejecutar(db, provider);

    expect(db.jugadores[0]!.status).toBe('INJURED');
  });

  it('da el alta a quien solo tiene partes antiguos: el histórico no debe marcar lesión', async () => {
    const db = crearDb([{ id: 1, externalId: 'p1', status: 'INJURED', manuallyEdited: false, enCompeticion: true }]);
    // Parte de hace 60 días: fuera de la ventana de vigencia.
    const provider = crearProveedor([{ playerExternalId: 'p1', type: 'Muscle Injury', date: hace(60).toISOString() }]);

    await ejecutar(db, provider);

    expect(db.jugadores[0]!.status).toBe('AVAILABLE');
  });

  it('da el alta a quien ya no aparece en ningún parte', async () => {
    const db = crearDb([{ id: 1, externalId: 'p1', status: 'INJURED', manuallyEdited: false, enCompeticion: true }]);
    const provider = crearProveedor([]);

    await ejecutar(db, provider);

    expect(db.jugadores[0]!.status).toBe('AVAILABLE');
  });

  it('cierra con resolvedAt las lesiones abiertas al dar el alta', async () => {
    const lesiones = [{ playerId: 1, type: 'Muscle Injury', startDate: hace(60), resolvedAt: null }];
    const db = crearDb(
      [{ id: 1, externalId: 'p1', status: 'INJURED', manuallyEdited: false, enCompeticion: true }],
      lesiones,
    );

    await ejecutar(db, crearProveedor([]));

    expect(lesiones[0]!.resolvedAt).toBeInstanceOf(Date);
  });

  it('respeta las ediciones manuales y no toca ese estado', async () => {
    const db = crearDb([{ id: 1, externalId: 'p1', status: 'INJURED', manuallyEdited: true, enCompeticion: true }]);

    await ejecutar(db, crearProveedor([]));

    expect(db.jugadores[0]!.status).toBe('INJURED');
  });

  it('distingue la duda de la lesión', async () => {
    const db = crearDb([{ id: 1, externalId: 'p1', status: 'AVAILABLE', manuallyEdited: false, enCompeticion: true }]);
    const provider = crearProveedor([{ playerExternalId: 'p1', type: 'Questionable', date: hace(1).toISOString() }]);

    await ejecutar(db, provider);

    expect(db.jugadores[0]!.status).toBe('DOUBT');
  });

  it('si hay parte de lesión y de duda a la vez, prevalece la lesión', async () => {
    const db = crearDb([{ id: 1, externalId: 'p1', status: 'AVAILABLE', manuallyEdited: false, enCompeticion: true }]);
    const provider = crearProveedor([
      { playerExternalId: 'p1', type: 'Questionable', date: hace(3).toISOString() },
      { playerExternalId: 'p1', type: 'Muscle Injury', date: hace(1).toISOString() },
    ]);

    await ejecutar(db, provider);

    expect(db.jugadores[0]!.status).toBe('INJURED');
  });

  it('no da el alta a jugadores ajenos a la competición sincronizada', async () => {
    const db = crearDb([{ id: 1, externalId: 'p1', status: 'INJURED', manuallyEdited: false, enCompeticion: false }]);

    await ejecutar(db, crearProveedor([]));

    // Su alta corresponde a la sincronización de SU competición, no a esta.
    expect(db.jugadores[0]!.status).toBe('INJURED');
  });

  it('registra el parte en el historial aunque esté fuera de la ventana', async () => {
    const lesiones: LesionFalsa[] = [];
    const db = crearDb(
      [{ id: 1, externalId: 'p1', status: 'AVAILABLE', manuallyEdited: false, enCompeticion: true }],
      lesiones,
    );
    const provider = crearProveedor([{ playerExternalId: 'p1', type: 'Old Injury', date: hace(90).toISOString() }]);

    await ejecutar(db, provider);

    expect(lesiones).toHaveLength(1);
    expect(db.jugadores[0]!.status).toBe('AVAILABLE');
  });
});
