export type IntelligenceSignalKind =
  | 'SCORING'
  | 'RESULT'
  | 'MATCH_GOALS'
  | 'BTTS'
  | 'CLEAN_SHEET'
  | 'SHOTS'
  | 'CREATION'
  | 'DEFENDING'
  | 'DISCIPLINE';

export interface IntelligenceSignal {
  key: string;
  kind: IntelligenceSignalKind;
  label: string;
  hits: number;
  sampleSize: number;
  hitRate: number;
  consistencyScore: number;
}

export interface TeamIntelligenceSample {
  ownGoals: number;
  opponentGoals: number;
}

export interface PlayerIntelligenceSample {
  goals?: number | null;
  assists?: number | null;
  shotsTotal?: number | null;
  shotsOnTarget?: number | null;
  keyPasses?: number | null;
  tacklesWon?: number | null;
  foulsCommitted?: number | null;
}

interface CandidateSignal {
  key: string;
  kind: IntelligenceSignalKind;
  label: string;
  hits: number;
  sampleSize: number;
}

const DEFAULT_MIN_SAMPLE = 5;
const DEFAULT_MIN_HIT_RATE = 0.6;

function roundRate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Índice de consistencia de 0 a 100. No representa una probabilidad futura.
 * Combina frecuencia observada y tamaño de muestra, premiando ventanas completas.
 */
export function intelligenceConsistencyScore(hits: number, sampleSize: number): number {
  if (sampleSize <= 0) return 0;
  const hitRate = hits / sampleSize;
  const sampleWeight = Math.min(sampleSize / 10, 1);
  return Math.round((hitRate * 0.82 + sampleWeight * 0.18) * 100);
}

function finalizeSignals(
  candidates: CandidateSignal[],
  minSample = DEFAULT_MIN_SAMPLE,
  minHitRate = DEFAULT_MIN_HIT_RATE,
): IntelligenceSignal[] {
  return candidates
    .filter((signal) => signal.sampleSize >= minSample)
    .map((signal) => ({
      ...signal,
      hitRate: roundRate(signal.hits / signal.sampleSize),
      consistencyScore: intelligenceConsistencyScore(signal.hits, signal.sampleSize),
    }))
    .filter((signal) => signal.hitRate >= minHitRate)
    .sort(
      (a, b) =>
        b.consistencyScore - a.consistencyScore ||
        b.hitRate - a.hitRate ||
        b.sampleSize - a.sampleSize ||
        a.label.localeCompare(b.label),
    );
}

export function buildTeamIntelligenceSignals(
  matches: TeamIntelligenceSample[],
  options: { minSample?: number; minHitRate?: number } = {},
): IntelligenceSignal[] {
  const window = matches.slice(0, 10);
  if (window.length === 0) return [];

  const count = (predicate: (sample: TeamIntelligenceSample) => boolean) =>
    window.filter(predicate).length;

  const candidates: CandidateSignal[] = [
    {
      key: 'team-score-1',
      kind: 'SCORING',
      label: 'Marca 1+ gol',
      hits: count((m) => m.ownGoals >= 1),
      sampleSize: window.length,
    },
    {
      key: 'team-score-2',
      kind: 'SCORING',
      label: 'Marca 2+ goles',
      hits: count((m) => m.ownGoals >= 2),
      sampleSize: window.length,
    },
    {
      key: 'team-unbeaten',
      kind: 'RESULT',
      label: 'No pierde',
      hits: count((m) => m.ownGoals >= m.opponentGoals),
      sampleSize: window.length,
    },
    {
      key: 'team-win',
      kind: 'RESULT',
      label: 'Gana',
      hits: count((m) => m.ownGoals > m.opponentGoals),
      sampleSize: window.length,
    },
    {
      key: 'match-over-15',
      kind: 'MATCH_GOALS',
      label: 'Partido +1.5 goles',
      hits: count((m) => m.ownGoals + m.opponentGoals >= 2),
      sampleSize: window.length,
    },
    {
      key: 'match-over-25',
      kind: 'MATCH_GOALS',
      label: 'Partido +2.5 goles',
      hits: count((m) => m.ownGoals + m.opponentGoals >= 3),
      sampleSize: window.length,
    },
    {
      key: 'match-btts',
      kind: 'BTTS',
      label: 'Ambos equipos marcan',
      hits: count((m) => m.ownGoals > 0 && m.opponentGoals > 0),
      sampleSize: window.length,
    },
    {
      key: 'team-clean-sheet',
      kind: 'CLEAN_SHEET',
      label: 'Portería a cero',
      hits: count((m) => m.opponentGoals === 0),
      sampleSize: window.length,
    },
  ];

  return finalizeSignals(candidates, options.minSample, options.minHitRate);
}

function playerMetricSignal(
  samples: PlayerIntelligenceSample[],
  metric: keyof PlayerIntelligenceSample,
  threshold: number,
  key: string,
  kind: IntelligenceSignalKind,
  label: string,
): CandidateSignal {
  const values = samples
    .slice(0, 10)
    .map((sample) => sample[metric])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return {
    key,
    kind,
    label,
    hits: values.filter((value) => value >= threshold).length,
    sampleSize: values.length,
  };
}

export function buildPlayerIntelligenceSignals(
  matches: PlayerIntelligenceSample[],
  options: { minSample?: number; minHitRate?: number } = {},
): IntelligenceSignal[] {
  if (matches.length === 0) return [];

  const candidates: CandidateSignal[] = [
    playerMetricSignal(matches, 'shotsTotal', 1, 'player-shot-1', 'SHOTS', '1+ tiro'),
    playerMetricSignal(matches, 'shotsTotal', 2, 'player-shot-2', 'SHOTS', '2+ tiros'),
    playerMetricSignal(matches, 'shotsOnTarget', 1, 'player-sot-1', 'SHOTS', '1+ tiro a puerta'),
    playerMetricSignal(matches, 'keyPasses', 1, 'player-key-pass-1', 'CREATION', '1+ pase clave'),
    playerMetricSignal(matches, 'tacklesWon', 1, 'player-tackle-1', 'DEFENDING', '1+ entrada ganada'),
    playerMetricSignal(matches, 'foulsCommitted', 1, 'player-foul-1', 'DISCIPLINE', '1+ falta cometida'),
    playerMetricSignal(matches, 'goals', 1, 'player-goal-1', 'SCORING', 'Marca gol'),
    playerMetricSignal(matches, 'assists', 1, 'player-assist-1', 'CREATION', 'Da asistencia'),
  ];

  return finalizeSignals(candidates, options.minSample, options.minHitRate);
}
