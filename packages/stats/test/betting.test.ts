import { describe, expect, it } from 'vitest';
import {
  combinedOdds,
  effectiveOdds,
  findConflicts,
  impliedProbability,
  potentialProfit,
  potentialReturn,
  resolveBetStatus,
  resolveSelection,
  riskLevel,
  validateOdds,
  type BetSelection,
} from '../src/betting';

const sel = (matchId: number, market: BetSelection['market'], option: string, odds = 2): BetSelection => ({
  matchId,
  competition: 'LaLiga',
  matchLabel: 'A – B',
  kickoffAt: '2026-08-01T18:00:00Z',
  market,
  option,
  odds,
});

describe('validateOdds', () => {
  it('acepta decimales con coma o punto', () => {
    expect(validateOdds('1,85')).toEqual({ value: 1.85, error: null });
    expect(validateOdds('2.5')).toEqual({ value: 2.5, error: null });
  });
  it('rechaza cuotas <= 1, negativas o no numéricas', () => {
    expect(validateOdds('1').error).not.toBeNull();
    expect(validateOdds('0,5').error).not.toBeNull();
    expect(validateOdds('-2').error).not.toBeNull();
    expect(validateOdds('abc').error).not.toBeNull();
    expect(validateOdds('').error).not.toBeNull();
  });
});

describe('cálculos', () => {
  it('probabilidad implícita = 1/cuota en %', () => {
    expect(impliedProbability(2)).toBe(50);
    expect(impliedProbability(4)).toBe(25);
    expect(impliedProbability(1.5)).toBe(66.7);
  });
  it('cuota combinada multiplica sin errores de precisión visibles', () => {
    expect(combinedOdds([1.5, 2])).toBe(3);
    expect(combinedOdds([1.1, 1.1, 1.1])).toBe(1.33);
    expect(combinedOdds([])).toBe(0);
  });
  it('retorno y beneficio potencial', () => {
    expect(potentialReturn(10, 3)).toBe(30);
    expect(potentialProfit(10, 3)).toBe(20);
    expect(potentialReturn(0, 3)).toBe(0);
    expect(potentialProfit(10, 0)).toBe(0);
  });
});

describe('riesgo', () => {
  it('escala con cuota total y número de selecciones', () => {
    expect(riskLevel(1.4, 1)).toBe('BAJO');
    expect(riskLevel(2.5, 1)).toBe('MEDIO');
    expect(riskLevel(5, 2)).toBe('ALTO');
    expect(riskLevel(12, 3)).toBe('MUY_ALTO');
    expect(riskLevel(3, 6)).toBe('MUY_ALTO');
  });
});

describe('conflictos', () => {
  it('bloquea dos opciones del mismo mercado en el mismo partido', () => {
    const c = findConflicts([sel(1, 'GANADOR', 'LOCAL'), sel(1, 'GANADOR', 'VISITANTE')]);
    expect(c).toHaveLength(1);
    expect(c[0]!.blocking).toBe(true);
  });
  it('bloquea contradicciones entre mercados (local + empate/visitante)', () => {
    const c = findConflicts([sel(2, 'GANADOR', 'LOCAL'), sel(2, 'DOBLE_OPORTUNIDAD', 'EMPATE_VISITANTE')]);
    expect(c).toHaveLength(1);
    expect(c[0]!.blocking).toBe(true);
  });
  it('avisa (sin bloquear) de mercados correlacionados compatibles', () => {
    const c = findConflicts([sel(3, 'GANADOR', 'LOCAL'), sel(3, 'GOLES_2_5', 'MAS')]);
    expect(c).toHaveLength(1);
    expect(c[0]!.blocking).toBe(false);
  });
  it('sin conflicto entre partidos distintos', () => {
    expect(findConflicts([sel(1, 'GANADOR', 'LOCAL'), sel(2, 'GANADOR', 'LOCAL')])).toHaveLength(0);
  });
});

describe('resolución', () => {
  const finished = (h: number, a: number) => ({ status: 'FINISHED', homeGoals: h, awayGoals: a });
  it('resuelve todos los mercados con el marcador final', () => {
    expect(resolveSelection({ market: 'GANADOR', option: 'LOCAL' }, finished(2, 1))).toBe('GANADA');
    expect(resolveSelection({ market: 'GANADOR', option: 'EMPATE' }, finished(2, 1))).toBe('PERDIDA');
    expect(resolveSelection({ market: 'DOBLE_OPORTUNIDAD', option: 'EMPATE_VISITANTE' }, finished(1, 1))).toBe('GANADA');
    expect(resolveSelection({ market: 'GOLES_2_5', option: 'MAS' }, finished(2, 1))).toBe('GANADA');
    expect(resolveSelection({ market: 'GOLES_2_5', option: 'MENOS' }, finished(1, 1))).toBe('GANADA');
    expect(resolveSelection({ market: 'AMBOS_MARCAN', option: 'SI' }, finished(2, 0))).toBe('PERDIDA');
    expect(resolveSelection({ market: 'AMBOS_MARCAN', option: 'NO' }, finished(2, 0))).toBe('GANADA');
  });
  it('pendiente si no ha terminado o faltan goles; anulada si se suspendió', () => {
    expect(resolveSelection({ market: 'GANADOR', option: 'LOCAL' }, { status: 'SCHEDULED', homeGoals: null, awayGoals: null })).toBe('PENDIENTE');
    expect(resolveSelection({ market: 'GANADOR', option: 'LOCAL' }, { status: 'FINISHED', homeGoals: null, awayGoals: null })).toBe('PENDIENTE');
    expect(resolveSelection({ market: 'GANADOR', option: 'LOCAL' }, { status: 'CANCELLED', homeGoals: null, awayGoals: null })).toBe('ANULADA');
  });
});

describe('estado global', () => {
  it('combina resultados de selecciones', () => {
    expect(resolveBetStatus(['GANADA', 'GANADA'])).toBe('GANADA');
    expect(resolveBetStatus(['GANADA', 'PERDIDA'])).toBe('PERDIDA');
    expect(resolveBetStatus(['GANADA', 'PENDIENTE'])).toBe('PENDIENTE');
    expect(resolveBetStatus(['ANULADA', 'ANULADA'])).toBe('ANULADA');
    expect(resolveBetStatus(['GANADA', 'ANULADA'])).toBe('PARCIALMENTE_ANULADA');
    expect(resolveBetStatus([])).toBe('BORRADOR');
  });
  it('cuota efectiva trata anuladas como 1', () => {
    expect(effectiveOdds([
      { odds: 2, outcome: 'GANADA' },
      { odds: 3, outcome: 'ANULADA' },
    ])).toBe(2);
  });
});
