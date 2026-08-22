import { describe, expect, it } from 'vitest';
import {
  API_FOOTBALL_SAFE_DAILY_LIMIT,
  clampApiFootballDailyLimit,
} from './budget-policy';

describe('API-Football budget policy', () => {
  it('caps the operational budget at 75% of 5000 requests', () => {
    expect(API_FOOTBALL_SAFE_DAILY_LIMIT).toBe(3750);
    expect(clampApiFootballDailyLimit(5000)).toBe(3750);
    expect(clampApiFootballDailyLimit(7500)).toBe(3750);
  });

  it('allows a lower configured ceiling', () => {
    expect(clampApiFootballDailyLimit(3000)).toBe(3000);
  });
});
