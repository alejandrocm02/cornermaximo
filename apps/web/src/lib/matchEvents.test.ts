import { describe, expect, it } from 'vitest';
import { describeMatchEvent } from './matchEvents';

describe('describeMatchEvent', () => {
  it('traduce el motivo de las tarjetas y no repite el tipo', () => {
    expect(describeMatchEvent('YELLOW_CARD', 'Yellow Card · Foul')).toMatchObject({ title: 'Tarjeta amarilla', note: 'Falta' });
    expect(describeMatchEvent('YELLOW_CARD', 'Yellow Card · Time Wasting').note).toBe('Pérdida de tiempo');
    expect(describeMatchEvent('RED_CARD', 'Red Card · Professional foul last man')).toMatchObject({
      title: 'Tarjeta roja',
      note: 'Falta como último defensor',
    });
  });

  it('no muestra motivos desconocidos en inglés', () => {
    expect(describeMatchEvent('YELLOW_CARD', 'Yellow Card · Other reason').note).toBeNull();
    expect(describeMatchEvent('YELLOW_CARD', 'Yellow Card').note).toBeNull();
    expect(describeMatchEvent('RED_CARD', null).note).toBeNull();
  });

  it('en los cambios indica quién sale y quién entra', () => {
    expect(describeMatchEvent('SUBSTITUTION', 'Substitution 3')).toEqual({
      title: 'Cambio 3',
      note: null,
      playerLabel: 'Sale',
      secondaryLabel: 'Entra',
    });
  });

  it('solo los goles normales tienen asistencia', () => {
    expect(describeMatchEvent('GOAL', 'Normal Goal')).toMatchObject({ title: 'Gol', note: null, secondaryLabel: 'Asistencia de' });
    expect(describeMatchEvent('PENALTY_GOAL', 'Penalty').secondaryLabel).toBeNull();
    expect(describeMatchEvent('OWN_GOAL', 'Own Goal').secondaryLabel).toBeNull();
  });

  it('marca la tanda de penaltis', () => {
    expect(describeMatchEvent('PENALTY_GOAL', 'Penalty · Penalty Shootout').note).toBe('Tanda de penaltis');
    expect(describeMatchEvent('MISSED_PENALTY', 'Missed Penalty · Penalty Shootout').note).toBe('Tanda de penaltis');
  });

  it('traduce las decisiones del VAR', () => {
    expect(describeMatchEvent('VAR', 'Goal cancelled').title).toBe('VAR · Gol anulado');
    expect(describeMatchEvent('VAR', 'Goal Disallowed - offside').title).toBe('VAR · Gol anulado por fuera de juego');
    expect(describeMatchEvent('VAR', 'Algo nuevo').title).toBe('Revisión del VAR');
  });
});
