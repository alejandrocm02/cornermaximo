import { describe, expect, it } from 'vitest';
import { normalizeDatabaseUrl } from './connection-url';

describe('normalizeDatabaseUrl', () => {
  it.each(['prefer', 'require', 'verify-ca'])(
    'preserva la verificación TLS fuerte para sslmode=%s',
    (mode) => {
      expect(normalizeDatabaseUrl(`postgresql://user:pass@db.example/app?sslmode=${mode}`)).toBe(
        'postgresql://user:pass@db.example/app?sslmode=verify-full',
      );
    },
  );

  it('conserva parámetros adicionales y modos ya explícitos', () => {
    expect(
      normalizeDatabaseUrl(
        'postgresql://user:pass@db.example/app?connect_timeout=10&sslmode=verify-full',
      ),
    ).toBe('postgresql://user:pass@db.example/app?connect_timeout=10&sslmode=verify-full');
  });

  it('no modifica conexiones locales sin sslmode', () => {
    const local = 'postgresql://postgres:postgres@127.0.0.1:5432/cornermaximo';
    expect(normalizeDatabaseUrl(local)).toBe(local);
  });
});
