import { describe, expect, it } from 'vitest';
import {
  buildPlayerIntelligenceSignals,
  buildTeamIntelligenceSignals,
  intelligenceConsistencyScore,
} from '../src/intelligence';

describe('CM Intelligence', () => {
  it('detects frequent team patterns without treating them as probabilities', () => {
    const signals = buildTeamIntelligenceSignals([
      { ownGoals: 2, opponentGoals: 1 },
      { ownGoals: 1, opponentGoals: 1 },
      { ownGoals: 3, opponentGoals: 0 },
      { ownGoals: 2, opponentGoals: 2 },
      { ownGoals: 1, opponentGoals: 0 },
      { ownGoals: 0, opponentGoals: 1 },
      { ownGoals: 2, opponentGoals: 1 },
      { ownGoals: 1, opponentGoals: 1 },
      { ownGoals: 4, opponentGoals: 1 },
      { ownGoals: 2, opponentGoals: 0 },
    ]);

    const scores = signals.find((signal) => signal.key === 'team-score-1');
    expect(scores).toMatchObject({ hits: 9, sampleSize: 10, hitRate: 0.9 });
    expect(scores?.consistencyScore).toBeGreaterThanOrEqual(90);

    const unbeaten = signals.find((signal) => signal.key === 'team-unbeaten');
    expect(unbeaten).toMatchObject({ hits: 9, sampleSize: 10, hitRate: 0.9 });
  });

  it('ignores missing provider metrics instead of converting null to zero', () => {
    const signals = buildPlayerIntelligenceSignals([
      { shotsOnTarget: 1 },
      { shotsOnTarget: 2 },
      { shotsOnTarget: null },
      { shotsOnTarget: 1 },
      { shotsOnTarget: 0 },
      { shotsOnTarget: 1 },
      { shotsOnTarget: undefined },
    ]);

    const onTarget = signals.find((signal) => signal.key === 'player-sot-1');
    expect(onTarget).toMatchObject({ hits: 4, sampleSize: 5, hitRate: 0.8 });
  });

  it('does not expose weak samples by default', () => {
    const signals = buildPlayerIntelligenceSignals([
      { tacklesWon: 1 },
      { tacklesWon: 1 },
      { tacklesWon: 1 },
      { tacklesWon: 1 },
    ]);

    expect(signals).toEqual([]);
  });

  it('scores a complete 10/10 sample at 100', () => {
    expect(intelligenceConsistencyScore(10, 10)).toBe(100);
  });
});
