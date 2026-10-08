import { describe, expect, it } from 'vitest';
import { computeLineTrend } from '../src/trends';

describe('computeLineTrend', () => {
  const line = (minutes: number, value: number | null) => ({ minutes, value });

  it('mide cada ventana solo con los partidos que tienen dato', () => {
    // Ventana reciente: 2 pases clave en 180 min medidos; un partido de 90 min sin acta.
    const recent = [line(90, 1), line(90, 1), line(90, null)];
    const previous = [line(90, 1), line(90, 1), line(90, 0)];
    const trend = computeLineTrend(recent, previous, (l) => l.value);
    expect(trend.recentPer90).toBe(1);
    expect(trend.previousPer90).toBe(0.67);
    expect(trend.direction).toBe('UP');
  });

  it('muestra insuficiente si los minutos medidos no llegan al mínimo', () => {
    const recent = [line(90, 2), line(90, null), line(90, null)];
    const previous = [line(90, 1), line(90, 1), line(90, 1)];
    expect(computeLineTrend(recent, previous, (l) => l.value).direction).toBe('INSUFFICIENT_SAMPLE');
  });
});
