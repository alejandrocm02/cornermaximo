import { describe, expect, it } from 'vitest';
import { displayTeamName, foldAccents, toSlug } from '../src';

describe('displayTeamName', () => {
  it('restaura tildes y eñes de clubes que el proveedor publica sin ellas', () => {
    expect(displayTeamName('Deportivo La Coruna')).toBe('Deportivo La Coruña');
    expect(displayTeamName('Cadiz')).toBe('Cádiz');
  });

  it('no altera el resto de nombres ni cambia el slug', () => {
    expect(displayTeamName('Barcelona')).toBe('Barcelona');
    expect(toSlug(displayTeamName('Deportivo La Coruna'))).toBe(toSlug('Deportivo La Coruna'));
  });
});

describe('foldAccents', () => {
  it('permite enlazar titulares con o sin tildes', () => {
    expect(foldAccents('El Cádiz ficha')).toContain(foldAccents('Cadiz'));
    expect(foldAccents('Cadiz sign striker')).toContain(foldAccents('Cádiz'));
  });
});
