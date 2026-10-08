import { describe, expect, it } from 'vitest';
import { aggregateFieldPlayer, aggregateGoalkeeper, type GoalkeeperMatchLine, type PlayerMatchLine } from './aggregate';

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

    expect(summary.metrics.tackles).toEqual({ total: 5, perMatch: 2.5, per90: 3.33, sampleMatches: 2 });
    expect(summary.metrics.foulsCommitted).toEqual({ total: 3, perMatch: 1.5, per90: 2, sampleMatches: 2 });
    expect(summary.metrics.foulsDrawn).toEqual({ total: 4, perMatch: 2, per90: 2.67, sampleMatches: 2 });
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

describe('medias con la muestra real de cada métrica', () => {
  // Caso real (J. Bellingham, octubre de 2026): 1 asistencia en 4 partidos con
  // dato (291 min) y un partido de 95 min sin estadísticas. El resumen decía
  // 0,23/90 y la tabla partido a partido 0,31/90.
  it('divide solo entre los partidos y minutos que tienen dato', () => {
    const summary = aggregateFieldPlayer([
      { ...baseLine, matchId: 1, minutes: 28, assists: 1 },
      { ...baseLine, matchId: 2, minutes: 90, assists: 0 },
      { ...baseLine, matchId: 3, minutes: 90, assists: 0 },
      { ...baseLine, matchId: 4, minutes: 95, assists: null },
      { ...baseLine, matchId: 5, minutes: 83, assists: 0 },
    ]);

    expect(summary.minutes).toBe(386);
    expect(summary.metrics.assists).toEqual({ total: 1, perMatch: 0.25, per90: 0.31, sampleMatches: 4 });
  });

  it('G+A solo cuenta partidos con goles y asistencias conocidos', () => {
    const summary = aggregateFieldPlayer([
      { ...baseLine, matchId: 1, goals: 1, assists: 1 },
      { ...baseLine, matchId: 2, goals: null, assists: 1 },
    ]);

    expect(summary.metrics.goalContributions).toEqual({ total: 2, perMatch: 2, per90: 2, sampleMatches: 1 });
  });

  it('el porcentaje de pase usa solo partidos con intentados y completados', () => {
    const summary = aggregateFieldPlayer([
      { ...baseLine, matchId: 1, passesAttempted: 10, passesCompleted: 9 },
      { ...baseLine, matchId: 2, passesAttempted: 40, passesCompleted: null },
    ]);

    expect(summary.rates.passAccuracy).toBe(90);
  });

  it('una métrica sin ningún dato queda null con muestra 0', () => {
    const summary = aggregateFieldPlayer([{ ...baseLine, recoveries: null }]);
    expect(summary.metrics.recoveries).toEqual({ total: null, perMatch: null, per90: null, sampleMatches: 0 });
  });

  it('porterías a cero por partido usan solo partidos con el dato', () => {
    const gk: GoalkeeperMatchLine = {
      matchId: 1, minutes: 90, rating: 7, goalsConceded: 0, cleanSheet: true, shotsOnTargetFaced: 3, saves: 3, penaltiesSaved: 0,
    };
    const summary = aggregateGoalkeeper([gk, { ...gk, matchId: 2, cleanSheet: null, goalsConceded: null }]);
    expect(summary.metrics.cleanSheets).toEqual({ total: 1, perMatch: 1, per90: 1, sampleMatches: 1 });
  });
});
