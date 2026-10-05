import { describe, expect, it } from 'vitest';
import { AWAITING_RESULT_AFTER_MS, formatMatchDate, isAwaitingResult } from './football';

describe('formatMatchDate', () => {
  it('muestra la hora española aunque el servidor corra en UTC', () => {
    expect(formatMatchDate(new Date('2026-10-05T18:30:00Z'))).toContain('20:30');
    // Horario de invierno: UTC+1.
    expect(formatMatchDate(new Date('2026-12-05T20:00:00Z'))).toContain('21:00');
  });

  it('usa el día español cuando el partido cruza la medianoche en UTC', () => {
    expect(formatMatchDate(new Date('2026-10-05T22:30:00Z'))).toMatch(/^06 oct/);
  });
});

describe('isAwaitingResult', () => {
  const now = Date.parse('2026-09-29T10:00:00Z');
  const ago = (ms: number) => new Date(now - ms);

  it('marca los partidos sin cerrar cuyo inicio ya quedó muy atrás', () => {
    expect(isAwaitingResult('LIVE', ago(AWAITING_RESULT_AFTER_MS + 1), now)).toBe(true);
    expect(isAwaitingResult('SCHEDULED', '2026-09-17T15:00:00Z', now)).toBe(true);
  });

  it('respeta los directos reales y los partidos futuros', () => {
    expect(isAwaitingResult('LIVE', ago(60 * 60 * 1000), now)).toBe(false);
    expect(isAwaitingResult('SCHEDULED', new Date(now + 1000), now)).toBe(false);
  });

  it('nunca afecta a estados cerrados', () => {
    expect(isAwaitingResult('FINISHED', '2026-09-01T15:00:00Z', now)).toBe(false);
    expect(isAwaitingResult('POSTPONED', '2026-09-01T15:00:00Z', now)).toBe(false);
  });
});
