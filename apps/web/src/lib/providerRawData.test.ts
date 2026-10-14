import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@cornermaximo/db', () => ({ prisma: {} }));

const { parseFormationGrid } = await import('./matches');

const SRC_DIR = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

// El 13-oct-2026 la web se cayó al superar los 5 GB de transferencia del plan
// Free de Neon. Gran parte venía de traer rawProviderData (el JSON original de
// API-Football, varios KB por fila) en cada ficha de jugador y de partido.
describe('estadísticas por partido sin JSON del proveedor', () => {
  it('no carga fieldStats ni gkStats enteros con include', () => {
    const offenders = sourceFiles(SRC_DIR)
      .filter((path) => /\b(fieldStats|gkStats)\s*:\s*true\b/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(SRC_DIR, path));

    expect(offenders).toEqual([]);
  });
});

describe('parseFormationGrid', () => {
  it('acepta el formato fila:columna de API-Football', () => {
    expect(parseFormationGrid('4:2')).toBe('4:2');
  });

  it('descarta valores ausentes o mal formados', () => {
    expect(parseFormationGrid(null)).toBeNull();
    expect(parseFormationGrid(undefined)).toBeNull();
    expect(parseFormationGrid('')).toBeNull();
    expect(parseFormationGrid('4-2')).toBeNull();
    expect(parseFormationGrid(42)).toBeNull();
  });
});
