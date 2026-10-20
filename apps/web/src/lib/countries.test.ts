import { describe, expect, it } from 'vitest';
import { countryNameEs } from './countries';

describe('countryNameEs', () => {
  it('traduce los nombres de API-Football', () => {
    expect(countryNameEs('Spain')).toBe('España');
    expect(countryNameEs('England')).toBe('Inglaterra');
    expect(countryNameEs('Ivory-Coast')).toBe('Costa de Marfil');
    expect(countryNameEs('World')).toBe('Internacional');
  });

  it('quita los guiones de un nombre desconocido', () => {
    expect(countryNameEs('Trinidad-And-Tobago')).toBe('Trinidad And Tobago');
  });

  it('respeta la ausencia de dato', () => {
    expect(countryNameEs(null)).toBeNull();
    expect(countryNameEs(undefined)).toBeNull();
  });
});
