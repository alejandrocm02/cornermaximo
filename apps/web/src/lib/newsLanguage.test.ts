import { describe, expect, it } from 'vitest';
import { newsLanguage, newsSourceFilter } from './newsLanguage';

describe('newsLanguage', () => {
  it('identifica los medios en inglés y trata el resto como español', () => {
    expect(newsLanguage('BBC Sport')).toBe('en');
    expect(newsLanguage('Sky Sports')).toBe('en');
    expect(newsLanguage('Marca')).toBe('es');
    expect(newsLanguage('Diario AS')).toBe('es');
  });

  it('construye filtros complementarios', () => {
    expect(newsSourceFilter('en')).toEqual({ in: ['BBC Sport', 'Sky Sports'] });
    expect(newsSourceFilter('es')).toEqual({ notIn: ['BBC Sport', 'Sky Sports'] });
  });
});
