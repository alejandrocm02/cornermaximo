import { describe, expect, it } from 'vitest';
import { AWAITING_RESULT_AFTER_MS, isAwaitingResult } from './football';

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
