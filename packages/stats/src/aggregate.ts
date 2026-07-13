/**
 * Agregación de los "últimos N partidos" de un jugador.
 * Entrada: filas normalizadas por partido (solo partidos con minutos > 0).
 * Los convocados sin minutos (BENCH_UNUSED) se muestran aparte y NO entran aquí.
 */
import { perMatch, per90, percentage, sumNullable } from './formulas';

export interface PlayerMatchLine {
  matchId: number;
  minutes: number;
  rating: number | null;
  goals: number | null;
  assists: number | null;
  shotsTotal: number | null;
  shotsOnTarget: number | null;
  passesAttempted: number | null;
  passesCompleted: number | null;
  keyPasses: number | null;
  foulsCommitted: number | null;
  foulsDrawn: number | null;
  tacklesWon: number | null;
  interceptions: number | null;
  recoveries: number | null;
  duelsTotal: number | null;
  duelsWon: number | null;
  yellowCards: number | null;
  redCards: number | null;
}

export interface GoalkeeperMatchLine {
  matchId: number;
  minutes: number;
  rating: number | null;
  goalsConceded: number | null;
  cleanSheet: boolean | null;
  shotsOnTargetFaced: number | null;
  saves: number | null;
  penaltiesSaved: number | null;
}

export interface MetricSummary {
  total: number | null;
  perMatch: number | null;
  per90: number | null;
}

export interface RecentSummary {
  matches: number;
  minutes: number;
  avgRating: number | null;
  /** matchId del mejor y peor partido por rating (null si no hay ratings). */
  bestMatchId: number | null;
  worstMatchId: number | null;
  metrics: Record<string, MetricSummary>;
  /** Porcentajes derivados (pases, duelos...). */
  rates: Record<string, number | null>;
}

function summarize(
  lines: Array<{ minutes: number; rating: number | null }>,
  totals: Record<string, number | null>,
  rates: Record<string, number | null>,
  byRating: Array<{ matchId: number; rating: number | null }>,
): RecentSummary {
  const matches = lines.length;
  const minutes = lines.reduce((a, l) => a + l.minutes, 0);

  const ratings = byRating.filter((r): r is { matchId: number; rating: number } => r.rating != null);
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, r) => a + r.rating, 0) / ratings.length) * 100) / 100
      : null;
  const sorted = [...ratings].sort((a, b) => b.rating - a.rating);

  const metrics: Record<string, MetricSummary> = {};
  for (const [key, total] of Object.entries(totals)) {
    metrics[key] = {
      total,
      perMatch: perMatch(total, matches),
      per90: per90(total, minutes),
    };
  }

  return {
    matches,
    minutes,
    avgRating,
    bestMatchId: sorted[0]?.matchId ?? null,
    worstMatchId: sorted.length > 0 ? sorted[sorted.length - 1]!.matchId : null,
    metrics,
    rates,
  };
}

export function aggregateFieldPlayer(lines: PlayerMatchLine[]): RecentSummary {
  const t = (k: keyof PlayerMatchLine) => sumNullable(lines.map((l) => l[k] as number | null));

  const totals: Record<string, number | null> = {
    goals: t('goals'),
    assists: t('assists'),
    goalContributions: sumNullable([t('goals'), t('assists')]),
    shotsTotal: t('shotsTotal'),
    shotsOnTarget: t('shotsOnTarget'),
    passesCompleted: t('passesCompleted'),
    keyPasses: t('keyPasses'),
    foulsCommitted: t('foulsCommitted'),
    foulsDrawn: t('foulsDrawn'),
    tacklesWon: t('tacklesWon'),
    interceptions: t('interceptions'),
    recoveries: t('recoveries'),
    duelsWon: t('duelsWon'),
    yellowCards: t('yellowCards'),
    redCards: t('redCards'),
  };

  const rates: Record<string, number | null> = {
    passAccuracy: percentage(t('passesCompleted'), t('passesAttempted')),
    duelWinRate: percentage(t('duelsWon'), t('duelsTotal')),
  };

  return summarize(lines, totals, rates, lines.map((l) => ({ matchId: l.matchId, rating: l.rating })));
}

export function aggregateGoalkeeper(lines: GoalkeeperMatchLine[]): RecentSummary {
  const t = (k: keyof GoalkeeperMatchLine) => sumNullable(lines.map((l) => l[k] as number | null));

  const cleanSheets = lines.filter((l) => l.cleanSheet === true).length;
  const anyCleanSheetData = lines.some((l) => l.cleanSheet != null);

  const totals: Record<string, number | null> = {
    goalsConceded: t('goalsConceded'),
    cleanSheets: anyCleanSheetData ? cleanSheets : null,
    shotsOnTargetFaced: t('shotsOnTargetFaced'),
    saves: t('saves'),
    penaltiesSaved: t('penaltiesSaved'),
  };

  const rates: Record<string, number | null> = {
    savePercentage: percentage(t('saves'), t('shotsOnTargetFaced')),
  };

  return summarize(lines, totals, rates, lines.map((l) => ({ matchId: l.matchId, rating: l.rating })));
}
