import { describe, expect, it } from 'vitest';
import { isFreshRefresh, isLiveEligible, LIVE_WINDOW_AFTER_MS, LIVE_WINDOW_BEFORE_MS } from './liveGuard';

const now = Date.parse('2026-10-05T18:00:00Z');
const at = (offsetMs: number) => new Date(now + offsetMs);

describe('isLiveEligible', () => {
  it('admite partidos en juego o a punto de empezar', () => {
    expect(isLiveEligible('LIVE', at(-60 * 60 * 1000), now)).toBe(true);
    expect(isLiveEligible('SCHEDULED', at(30 * 60 * 1000), now)).toBe(true);
  });

  it('admite la descarga final justo después de terminar', () => {
    expect(isLiveEligible('FINISHED', at(-2 * 60 * 60 * 1000), now)).toBe(true);
  });

  it('rechaza partidos lejanos, que son la vía para gastar cuota ajena', () => {
    expect(isLiveEligible('FINISHED', at(-30 * 24 * 60 * 60 * 1000), now)).toBe(false);
    expect(isLiveEligible('SCHEDULED', at(LIVE_WINDOW_BEFORE_MS + 1000), now)).toBe(false);
    expect(isLiveEligible('LIVE', at(-LIVE_WINDOW_AFTER_MS - 1000), now)).toBe(false);
  });

  it('rechaza estados cerrados sin juego', () => {
    expect(isLiveEligible('POSTPONED', at(0), now)).toBe(false);
    expect(isLiveEligible('CANCELLED', at(0), now)).toBe(false);
  });
});

describe('isFreshRefresh', () => {
  it('distingue una sincronización recién hecha de una servida desde el throttle', () => {
    expect(isFreshRefresh(new Date(now - 1000).toISOString(), now)).toBe(true);
    expect(isFreshRefresh(new Date(now - 15_000).toISOString(), now)).toBe(false);
    expect(isFreshRefresh('no-es-fecha', now)).toBe(false);
  });
});
