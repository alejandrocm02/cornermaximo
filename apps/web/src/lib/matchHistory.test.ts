import { describe, expect, it } from 'vitest';
import { historyParticipation, parseHistoryFilters, summarizeHistoryMetric, type HistoryMatch } from './matchHistory';

const match = (minutes: number, shots: number | null, role = 'STARTER') => ({
  minutes, role, stats: { shotsTotal: shots },
}) as HistoryMatch;

describe('player history calculations', () => {
  it('uses only covered playing time for each metric, retaining real zeroes', () => {
    const summary = summarizeHistoryMetric([
      match(30, 2), match(90, 0), match(90, null), match(0, 0, 'BENCH_UNUSED'),
    ], 'shotsTotal');
    expect(summary).toEqual({ average: 1, per90: 1.5, sample: 2 });
  });

  it('distinguishes missing coverage and no participation from a zero total', () => {
    expect(summarizeHistoryMetric([match(90, null), match(0, 0)], 'shotsTotal'))
      .toEqual({ average: null, per90: null, sample: 0 });
    expect(summarizeHistoryMetric([match(45, 0)], 'shotsTotal'))
      .toEqual({ average: 0, per90: 0, sample: 1 });
  });

  it('retains recorded participation roles instead of inferring an absence', () => {
    expect(historyParticipation(match(0, null, 'BENCH_UNUSED'))).toBe('Sin participar');
    expect(historyParticipation(match(0, null, 'NOT_CALLED'))).toBe('No convocado');
    expect(historyParticipation(match(25, 1, 'SUBSTITUTE'))).toBe('Suplente');
    expect(historyParticipation(match(90, 1))).toBe('Titular');
  });

  it('bounds windows and rejects malformed or repeated query parameters', () => {
    expect(parseHistoryFilters({ partidos: '999999', temporada: ['2026'], competicion: '1 OR 1=1', sede: 'other' }))
      .toEqual({ count: 5, year: null, competitionId: null, venue: 'all' });
    expect(parseHistoryFilters({ partidos: '20', temporada: '2026', competicion: '140', sede: 'away' }))
      .toEqual({ count: 20, year: 2026, competitionId: 140, venue: 'away' });
  });
});
