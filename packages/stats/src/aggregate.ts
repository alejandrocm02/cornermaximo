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
  /** API-Football `tackles.total`: entradas registradas para el jugador. */
  tacklesAttempted: number | null;
  /** Se conserva para proveedores que sí distingan entradas ganadas. API-Football no lo hace en fixtures/players. */
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
  /** Partidos con dato para esta métrica: son el denominador de perMatch y per90. */
  sampleMatches: number;
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

type LineValue<L> = (line: L) => number | null;

/**
 * Total, media por partido y por 90' de una métrica usando solo los partidos
 * que tienen dato para ella. Dividir un total parcial entre todos los minutos
 * infravaloraba la media, y la tabla partido a partido (que ya usaba solo los
 * partidos con dato) mostraba otra cifra para la misma métrica.
 */
function summarizeMetric<L extends { minutes: number }>(lines: L[], value: LineValue<L>): MetricSummary {
  const withData = lines.filter((line) => value(line) != null);
  const total = sumNullable(withData.map(value));
  const minutes = withData.reduce((a, line) => a + line.minutes, 0);
  return {
    total,
    perMatch: perMatch(total, withData.length),
    per90: per90(total, minutes),
    sampleMatches: withData.length,
  };
}

/** Porcentaje calculado solo con los partidos que tienen ambos valores. */
function pairedPercentage<L>(lines: L[], part: LineValue<L>, whole: LineValue<L>): number | null {
  const paired = lines.filter((line) => part(line) != null && whole(line) != null);
  return percentage(sumNullable(paired.map(part)), sumNullable(paired.map(whole)));
}

function summarize<L extends { matchId: number; minutes: number; rating: number | null }>(
  lines: L[],
  metricValues: Record<string, LineValue<L>>,
  rates: Record<string, number | null>,
): RecentSummary {
  const matches = lines.length;
  const minutes = lines.reduce((a, l) => a + l.minutes, 0);

  const ratings = lines
    .map((l) => ({ matchId: l.matchId, rating: l.rating }))
    .filter((r): r is { matchId: number; rating: number } => r.rating != null);
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, r) => a + r.rating, 0) / ratings.length) * 100) / 100
      : null;
  const sorted = [...ratings].sort((a, b) => b.rating - a.rating);

  const metrics: Record<string, MetricSummary> = {};
  for (const [key, value] of Object.entries(metricValues)) {
    metrics[key] = summarizeMetric(lines, value);
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

/** Goles + asistencias de un partido; null si falta cualquiera de los dos. */
export function goalContributionsOf(line: Pick<PlayerMatchLine, 'goals' | 'assists'>): number | null {
  return line.goals != null && line.assists != null ? line.goals + line.assists : null;
}

export function aggregateFieldPlayer(lines: PlayerMatchLine[]): RecentSummary {
  const field = (k: keyof PlayerMatchLine): LineValue<PlayerMatchLine> => (l) => l[k] as number | null;

  const metricValues: Record<string, LineValue<PlayerMatchLine>> = {
    goals: field('goals'),
    assists: field('assists'),
    goalContributions: goalContributionsOf,
    shotsTotal: field('shotsTotal'),
    shotsOnTarget: field('shotsOnTarget'),
    passesCompleted: field('passesCompleted'),
    keyPasses: field('keyPasses'),
    foulsCommitted: field('foulsCommitted'),
    foulsDrawn: field('foulsDrawn'),
    tackles: field('tacklesAttempted'),
    tacklesWon: field('tacklesWon'),
    interceptions: field('interceptions'),
    recoveries: field('recoveries'),
    duelsWon: field('duelsWon'),
    yellowCards: field('yellowCards'),
    redCards: field('redCards'),
  };

  const rates: Record<string, number | null> = {
    passAccuracy: pairedPercentage(lines, field('passesCompleted'), field('passesAttempted')),
    duelWinRate: pairedPercentage(lines, field('duelsWon'), field('duelsTotal')),
  };

  return summarize(lines, metricValues, rates);
}

export function aggregateGoalkeeper(lines: GoalkeeperMatchLine[]): RecentSummary {
  const field = (k: keyof GoalkeeperMatchLine): LineValue<GoalkeeperMatchLine> => (l) => l[k] as number | null;

  const metricValues: Record<string, LineValue<GoalkeeperMatchLine>> = {
    goalsConceded: field('goalsConceded'),
    cleanSheets: (l) => (l.cleanSheet == null ? null : l.cleanSheet ? 1 : 0),
    shotsOnTargetFaced: field('shotsOnTargetFaced'),
    saves: field('saves'),
    penaltiesSaved: field('penaltiesSaved'),
  };

  const rates: Record<string, number | null> = {
    savePercentage: pairedPercentage(lines, field('saves'), field('shotsOnTargetFaced')),
  };

  return summarize(lines, metricValues, rates);
}
