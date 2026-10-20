import { describe, expect, it } from 'vitest';
import { formatFixed, formatNumber } from './format';

describe('formatNumber', () => {
  it('usa coma decimal', () => {
    expect(formatNumber(1.82)).toBe('1,82');
    expect(formatNumber(7.8, 1)).toBe('7,8');
  });

  it('no añade ceros sobrantes ni decimales a enteros', () => {
    expect(formatNumber(2)).toBe('2');
    expect(formatNumber(0.5)).toBe('0,5');
  });

  it('agrupa miles', () => {
    expect(formatNumber(11787)).toBe('11.787');
  });

  it('marca la ausencia de dato', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
    expect(formatNumber(Number.NaN)).toBe('—');
  });
});

describe('formatFixed', () => {
  it('mantiene los decimales pedidos', () => {
    expect(formatFixed(7.5, 2)).toBe('7,50');
    expect(formatFixed(8.16, 1)).toBe('8,2');
    expect(formatFixed(null, 1)).toBe('—');
  });
});
