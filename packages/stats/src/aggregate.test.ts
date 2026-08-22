import { describe, expect, it } from 'vitest';
import { aggregateFieldPlayer, type PlayerMatchLine } from './aggregate';

const baseLine: PlayerMatchLine = {
  matchId: 1,
  minutes: 90,
  rating: 7,
  goals: 0,
  assists: 0,
  shotsTotal: 0,
  shotsOnTarget: 0,
  passesAttempted: 20,
  passesCompleted: 18,
  keyPasses: 0,
  foulsCommitted: 0,
  foulsDrawn: 0,
  tacklesAttempted: 0,
  tacklesWon: null,
  interceptions: 0,
  recoveries: null,
  duelsTotal: 4,
  duelsWon: 2,
  yellowCards: 0,
  redCards: 0,
};

describe('aggregateFieldPlayer defensive discipline metrics', () => {
  it('aggregates tackles and fouls with per-match and per-90 values', () => {
    const summary = aggregateFieldPlayer([
      { ...baseLine, matchId: 1, minutes: 90, tacklesAttempted: 3, foulsCommitted: 2, foulsDrawn: 1 },
      { ...baseLine, matchId: 2, minutes: 45, tacklesAttempted: 2, foulsCommitted: 1, foulsDrawn: 3 },
    ]);

    expect(summary.metrics.tackles).toEqual({ total: 5, perMatch: 2.5, per90: 3.33 });
    expect(summary.metrics.foulsCommitted).toEqual({ total: 3, perMatch: 1.5, per90: 2 });
    expect(summary.metrics.foulsDrawn).toEqual({ total: 4, perMatch: 2, per90: 2.67 });
  });

  it('keeps unavailable provider metrics as null instead of inventing zeroes', () => {
    const summary = aggregateFieldPlayer([
      { ...baseLine, tacklesAttempted: null, foulsCommitted: null, foulsDrawn: null },
    ]);

    expect(summary.metrics.tackles!.total).toBeNull();
    expect(summary.metrics.foulsCommitted!.total).toBeNull();
    expect(summary.metrics.foulsDrawn!.total).toBeNull();
    expect(summary.metrics.tacklesWon!.total).toBeNull();
  });
});
