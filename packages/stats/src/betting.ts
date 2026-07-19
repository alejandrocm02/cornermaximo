/**
 * Cálculos del creador de apuestas simuladas.
 * Herramienta informativa: no ejecuta apuestas reales ni maneja dinero.
 * Todas las fórmulas son transparentes y están cubiertas por tests.
 */

// ---------- mercados ----------

/**
 * Solo mercados resolubles con el marcador final que guardamos (goles por equipo).
 * No se ofrecen mercados que no podamos verificar con datos propios
 * (córners, tarjetas, goleador, descanso...).
 */
export const BET_MARKETS = {
  GANADOR: {
    label: 'Ganador del partido',
    options: { LOCAL: 'Gana local', EMPATE: 'Empate', VISITANTE: 'Gana visitante' },
  },
  DOBLE_OPORTUNIDAD: {
    label: 'Doble oportunidad',
    options: { LOCAL_EMPATE: 'Local o empate', LOCAL_VISITANTE: 'Local o visitante', EMPATE_VISITANTE: 'Empate o visitante' },
  },
  GOLES_2_5: {
    label: 'Goles (2,5)',
    options: { MAS: 'Más de 2,5 goles', MENOS: 'Menos de 2,5 goles' },
  },
  AMBOS_MARCAN: {
    label: 'Ambos equipos marcan',
    options: { SI: 'Sí', NO: 'No' },
  },
} as const;

export type BetMarketId = keyof typeof BET_MARKETS;
export type BetOptionId<M extends BetMarketId = BetMarketId> = keyof (typeof BET_MARKETS)[M]['options'] & string;

export interface BetSelection {
  /** Identificador interno del partido en FutStats. */
  matchId: number;
  competition: string;
  matchLabel: string; // "Equipo A – Equipo B"
  kickoffAt: string; // ISO
  market: BetMarketId;
  option: string;
  /** Cuota decimal introducida por el usuario (> 1). */
  odds: number;
}

export type SelectionOutcome = 'GANADA' | 'PERDIDA' | 'PENDIENTE' | 'ANULADA';

// ---------- validación de cuotas ----------

/** Valida una cuota decimal escrita por el usuario. Devuelve mensaje de error o null. */
export function validateOdds(raw: string): { value: number | null; error: string | null } {
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '') return { value: null, error: 'Introduce una cuota.' };
  if (!/^\d+(\.\d+)?$/.test(normalized)) return { value: null, error: 'Solo números, p. ej. 1,85.' };
  const value = Number(normalized);
  if (!Number.isFinite(value)) return { value: null, error: 'Cuota no válida.' };
  if (value <= 1) return { value: null, error: 'La cuota debe ser mayor que 1.' };
  if (value > 1000) return { value: null, error: 'Cuota fuera de rango.' };
  return { value: Math.round(value * 100) / 100, error: null };
}

// ---------- cálculos ----------

/** Probabilidad implícita de una cuota decimal, en porcentaje (0–100). */
export function impliedProbability(odds: number): number {
  if (!(odds > 1)) return 0;
  return Math.round((1 / odds) * 1000) / 10;
}

/** Cuota combinada: producto de las cuotas, redondeado a 2 decimales. */
export function combinedOdds(odds: number[]): number {
  if (odds.length === 0) return 0;
  const product = odds.reduce((acc, o) => acc * o, 1);
  return Math.round(product * 100) / 100;
}

/** Retorno potencial = importe × cuota total (2 decimales). */
export function potentialReturn(stake: number, totalOdds: number): number {
  if (!(stake > 0) || !(totalOdds > 0)) return 0;
  return Math.round(stake * totalOdds * 100) / 100;
}

/** Beneficio potencial = retorno − importe (2 decimales). */
export function potentialProfit(stake: number, totalOdds: number): number {
  const ret = potentialReturn(stake, totalOdds);
  if (ret === 0) return 0;
  return Math.round((ret - stake) * 100) / 100;
}

// ---------- riesgo ----------

export type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO' | 'MUY_ALTO';

export const RISK_LABELS: Record<RiskLevel, string> = {
  BAJO: 'Riesgo bajo',
  MEDIO: 'Riesgo medio',
  ALTO: 'Riesgo alto',
  MUY_ALTO: 'Riesgo muy alto',
};

/**
 * Nivel orientativo basado en criterios transparentes: cuota total y número de
 * selecciones. No es una predicción de éxito.
 */
export function riskLevel(totalOdds: number, selectionCount: number): RiskLevel {
  if (selectionCount === 0 || totalOdds <= 0) return 'BAJO';
  if (totalOdds >= 10 || selectionCount >= 6) return 'MUY_ALTO';
  if (totalOdds >= 4 || selectionCount >= 4) return 'ALTO';
  if (totalOdds >= 2 || selectionCount >= 2) return 'MEDIO';
  return 'BAJO';
}

// ---------- conflictos ----------

export interface SelectionConflict {
  matchId: number;
  reason: string;
  /** true = combinación imposible (bloquea guardar); false = solo aviso de correlación. */
  blocking: boolean;
}

/** Pares de opciones incompatibles entre mercados distintos del mismo partido. */
function contradictory(a: BetSelection, b: BetSelection): boolean {
  const key = (s: BetSelection) => `${s.market}:${s.option}`;
  const pair = new Set([key(a), key(b)]);
  const incompatible: Array<[string, string]> = [
    ['GANADOR:LOCAL', 'DOBLE_OPORTUNIDAD:EMPATE_VISITANTE'],
    ['GANADOR:VISITANTE', 'DOBLE_OPORTUNIDAD:LOCAL_EMPATE'],
    ['GANADOR:EMPATE', 'DOBLE_OPORTUNIDAD:LOCAL_VISITANTE'],
  ];
  return incompatible.some(([x, y]) => pair.has(x) && pair.has(y));
}

/** Detecta selecciones incompatibles o fuertemente correlacionadas del mismo partido. */
export function findConflicts(selections: BetSelection[]): SelectionConflict[] {
  const conflicts: SelectionConflict[] = [];
  const byMatch = new Map<number, BetSelection[]>();
  for (const s of selections) {
    byMatch.set(s.matchId, [...(byMatch.get(s.matchId) ?? []), s]);
  }
  for (const [matchId, list] of byMatch) {
    if (list.length < 2) continue;
    const sameMarket = list.some((s, i) => list.some((t, j) => j > i && t.market === s.market));
    const contradiction = list.some((s, i) => list.some((t, j) => j > i && contradictory(s, t)));
    if (sameMarket) {
      conflicts.push({
        matchId,
        blocking: true,
        reason: 'Hay dos pronósticos del mismo mercado en este partido: solo puede cumplirse uno.',
      });
    } else if (contradiction) {
      conflicts.push({
        matchId,
        blocking: true,
        reason: 'Los pronósticos de este partido se contradicen entre sí: no pueden cumplirse a la vez.',
      });
    } else {
      conflicts.push({
        matchId,
        blocking: false,
        reason:
          'Varios pronósticos del mismo partido están relacionados: la probabilidad combinada real no equivale a multiplicar las cuotas.',
      });
    }
  }
  return conflicts;
}

// ---------- resolución con el marcador final ----------

/**
 * Resuelve una selección con el marcador final. Devuelve PENDIENTE si el
 * partido no ha terminado y ANULADA si fue suspendido/cancelado.
 * Nunca inventa resultados: sin goles registrados no hay resolución.
 */
export function resolveSelection(
  selection: Pick<BetSelection, 'market' | 'option'>,
  match: { status: string; homeGoals: number | null; awayGoals: number | null },
): SelectionOutcome {
  if (['POSTPONED', 'SUSPENDED', 'ABANDONED', 'CANCELLED'].includes(match.status)) return 'ANULADA';
  if (match.status !== 'FINISHED' || match.homeGoals == null || match.awayGoals == null) return 'PENDIENTE';
  const { homeGoals: h, awayGoals: a } = match;
  const total = h + a;
  const won: Record<string, boolean> = {
    'GANADOR:LOCAL': h > a,
    'GANADOR:EMPATE': h === a,
    'GANADOR:VISITANTE': a > h,
    'DOBLE_OPORTUNIDAD:LOCAL_EMPATE': h >= a,
    'DOBLE_OPORTUNIDAD:LOCAL_VISITANTE': h !== a,
    'DOBLE_OPORTUNIDAD:EMPATE_VISITANTE': a >= h,
    'GOLES_2_5:MAS': total > 2.5,
    'GOLES_2_5:MENOS': total < 2.5,
    'AMBOS_MARCAN:SI': h > 0 && a > 0,
    'AMBOS_MARCAN:NO': h === 0 || a === 0,
  };
  const key = `${selection.market}:${selection.option}`;
  if (!(key in won)) return 'PENDIENTE'; // mercado no resoluble automáticamente
  return won[key]! ? 'GANADA' : 'PERDIDA';
}

// ---------- resultado global de una apuesta ----------

export type BetStatus = 'BORRADOR' | 'PENDIENTE' | 'GANADA' | 'PERDIDA' | 'ANULADA' | 'PARCIALMENTE_ANULADA';

/**
 * Estado global a partir de los resultados de las selecciones.
 * Las selecciones anuladas se excluyen de la cuota (cuota 1), como es convención.
 */
export function resolveBetStatus(outcomes: SelectionOutcome[]): BetStatus {
  if (outcomes.length === 0) return 'BORRADOR';
  if (outcomes.some((o) => o === 'PERDIDA')) return 'PERDIDA';
  if (outcomes.some((o) => o === 'PENDIENTE')) return 'PENDIENTE';
  if (outcomes.every((o) => o === 'ANULADA')) return 'ANULADA';
  if (outcomes.some((o) => o === 'ANULADA')) return 'PARCIALMENTE_ANULADA';
  return 'GANADA';
}

/** Cuota efectiva tras resolución: las selecciones anuladas cuentan como 1. */
export function effectiveOdds(selections: Array<{ odds: number; outcome: SelectionOutcome }>): number {
  const odds = selections.map((s) => (s.outcome === 'ANULADA' ? 1 : s.odds));
  return combinedOdds(odds);
}
