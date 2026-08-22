import { describe, expect, it } from 'vitest';
import {
  per90,
  perMatch,
  percentage,
  savePercentage,
  sumNullable,
} from '../src/formulas';
import { aggregateFieldPlayer, aggregateGoalkeeper, type PlayerMatchLine } from '../src/aggregate';
import { computeTrend, streak } from '../src/trends';

describe('per90', () => {
  it('calcula correctamente', () => {
    expect(per90(3, 270)).toBe(1);
    expect(per90(2, 450)).toBe(0.4);
  });
  it('división por cero => null', () => {
    expect(per90(3, 0)).toBeNull();
    expect(per90(3, -10)).toBeNull();
  });
  it('dato no disponible => null (no 0)', () => {
    expect(per90(null, 450)).toBeNull();
    expect(per90(undefined, 450)).toBeNull();
  });
});

describe('perMatch', () => {
  it('calcula correctamente', () => expect(perMatch(10, 4)).toBe(2.5));
  it('0 partidos => null', () => expect(perMatch(10, 0)).toBeNull());
  it('null => null', () => expect(perMatch(null, 5)).toBeNull());
});

describe('percentage', () => {
  it('calcula correctamente', () => expect(percentage(45, 50)).toBe(90));
  it('total 0 => null (no Infinity)', () => expect(percentage(5, 0)).toBeNull());
  it('nulls => null', () => {
    expect(percentage(null, 50)).toBeNull();
    expect(percentage(45, null)).toBeNull();
  });
  it('portero sin tiros recibidos => null', () => expect(savePercentage(0, 0)).toBeNull());
});

describe('sumNullable', () => {
  it('todos null => null (métrica no disponible)', () =>
    expect(sumNullable([null, null])).toBeNull());
  it('mezcla => suma los presentes', () => expect(sumNullable([2, null, 3])).toBe(5));
  it('vacío => null', () => expect(sumNullable([])).toBeNull());
});

const line = (overrides: Partial<PlayerMatchLine> & { matchId: number }): PlayerMatchLine => ({
  minutes: 90,
  rating: null,
  goals: 0,
  assists: 0,
  shotsTotal: null,
  shotsOnTarget: null,
  passesAttempted: null,
  passesCompleted: null,
  keyPasses: null,
  foulsCommitted: null,
  foulsDrawn: null,
  tacklesAttempted: null,
  tacklesWon: null,
  interceptions: null,
  recoveries: null,
  duelsTotal: null,
  duelsWon: null,
  yellowCards: null,
  redCards: null,
  ...overrides,
});

describe('aggregateFieldPlayer', () => {
  it('agrega totales, medias y per90', () => {
    const summary = aggregateFieldPlayer([
      line({ matchId: 1, goals: 2, assists: 1, minutes: 90, rating: 8.2 }),
      line({ matchId: 2, goals: 0, assists: 0, minutes: 45, rating: 6.1 }),
      line({ matchId: 3, goals: 1, assists: 0, minutes: 90, rating: 7.4 }),
    ]);
    expect(summary.matches).toBe(3);
    expect(summary.minutes).toBe(225);
    expect(summary.metrics.goals!.total).toBe(3);
    expect(summary.metrics.goals!.perMatch).toBe(1);
    expect(summary.metrics.goals!.per90).toBe(1.2);
    expect(summary.metrics.goalContributions!.total).toBe(4);
    expect(summary.avgRating).toBe(7.23);
    expect(summary.bestMatchId).toBe(1);
    expect(summary.worstMatchId).toBe(2);
  });

  it('métrica sin datos del proveedor queda null, no 0', () => {
    const summary = aggregateFieldPlayer([line({ matchId: 1 })]);
    expect(summary.metrics.keyPasses!.total).toBeNull();
    expect(summary.rates.passAccuracy).toBeNull();
  });

  it('sin partidos => estructura vacía coherente', () => {
    const summary = aggregateFieldPlayer([]);
    expect(summary.matches).toBe(0);
    expect(summary.minutes).toBe(0);
    expect(summary.metrics.goals!.total).toBeNull();
    expect(summary.avgRating).toBeNull();
  });
});

describe('aggregateGoalkeeper', () => {
  it('calcula porterías a cero y % de paradas', () => {
    const summary = aggregateGoalkeeper([
      { matchId: 1, minutes: 90, rating: 7, goalsConceded: 0, cleanSheet: true, shotsOnTargetFaced: 4, saves: 4, penaltiesSaved: 0 },
      { matchId: 2, minutes: 90, rating: 6, goalsConceded: 2, cleanSheet: false, shotsOnTargetFaced: 6, saves: 4, penaltiesSaved: 1 },
    ]);
    expect(summary.metrics.cleanSheets!.total).toBe(1);
    expect(summary.metrics.saves!.total).toBe(8);
    expect(summary.rates.savePercentage).toBe(80);
  });
});

describe('computeTrend', () => {
  it('detecta mejoría', () => {
    const t = computeTrend({ recentTotal: 4, recentMinutes: 450, previousTotal: 1, previousMinutes: 450 });
    expect(t.direction).toBe('UP');
  });
  it('banda de estabilidad ±10%', () => {
    const t = computeTrend({ recentTotal: 21, recentMinutes: 450, previousTotal: 20, previousMinutes: 450 });
    expect(t.direction).toBe('STABLE');
  });
  it('lowerIsBetter invierte la dirección (goles encajados)', () => {
    const t = computeTrend({
      recentTotal: 8, recentMinutes: 450,
      previousTotal: 3, previousMinutes: 450,
      lowerIsBetter: true,
    });
    expect(t.direction).toBe('DOWN');
  });
  it('minutos insuficientes => INSUFFICIENT_SAMPLE', () => {
    const t = computeTrend({ recentTotal: 2, recentMinutes: 100, previousTotal: 1, previousMinutes: 450 });
    expect(t.direction).toBe('INSUFFICIENT_SAMPLE');
  });
  it('datos no disponibles => INSUFFICIENT_SAMPLE', () => {
    const t = computeTrend({ recentTotal: null, recentMinutes: 450, previousTotal: 1, previousMinutes: 450 });
    expect(t.direction).toBe('INSUFFICIENT_SAMPLE');
  });
  it('base cero y reciente > 0 => UP', () => {
    const t = computeTrend({ recentTotal: 3, recentMinutes: 450, previousTotal: 0, previousMinutes: 450 });
    expect(t.direction).toBe('UP');
  });
  it('ambas cero => STABLE', () => {
    const t = computeTrend({ recentTotal: 0, recentMinutes: 450, previousTotal: 0, previousMinutes: 450 });
    expect(t.direction).toBe('STABLE');
  });
});

describe('streak', () => {
  it('cuenta partidos consecutivos marcando', () => {
    const games = [{ goals: 1 }, { goals: 2 }, { goals: 0 }, { goals: 1 }];
    expect(streak(games, (g) => g.goals > 0)).toBe(2);
  });
  it('racha rota en el primer partido => 0', () => {
    expect(streak([{ goals: 0 }, { goals: 3 }], (g) => g.goals > 0)).toBe(0);
  });
});
