import { describe, expect, it } from 'vitest';
import {
  isLiveEligible,
  isNewRefresh,
  isWithinInterval,
  LIVE_WINDOW_AFTER_MS,
  LIVE_WINDOW_BEFORE_MS,
} from './liveGuard';

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

describe('isWithinInterval', () => {
  it('considera vigente un resultado dentro del intervalo y caducado fuera', () => {
    expect(isWithinInterval(new Date(now - 15_000).toISOString(), 20_000, now)).toBe(true);
    expect(isWithinInterval(new Date(now - 45_000).toISOString(), 20_000, now)).toBe(false);
    expect(isWithinInterval('no-es-fecha', 20_000, now)).toBe(false);
  });
});

describe('isNewRefresh', () => {
  it('avisa una sola vez por sincronización, aunque llegue con retraso', () => {
    const at = new Date(now - 30_000).toISOString();
    expect(isNewRefresh('test:scoreboard', at)).toBe(true);
    expect(isNewRefresh('test:scoreboard', at)).toBe(false);
    expect(isNewRefresh('test:scoreboard', new Date(now).toISOString())).toBe(true);
  });

  it('lleva la cuenta por clave', () => {
    const at = new Date(now).toISOString();
    expect(isNewRefresh('test:core:1', at)).toBe(true);
    expect(isNewRefresh('test:core:2', at)).toBe(true);
    expect(isNewRefresh('test:core:1', at)).toBe(false);
  });
});
