import { describe, expect, it, vi } from 'vitest';

vi.mock('@cornermaximo/db', () => ({ prisma: {} }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));

import { dominantPlayedGroup } from './playerPosition';

describe('dominantPlayedGroup', () => {
  it('usa la línea en la que juega cuando difiere de la registrada', () => {
    expect(dominantPlayedGroup(['F', 'F', 'F', 'F', 'F'], 'MF')).toBe('FW');
  });

  it('mantiene la registrada con pocos partidos o sin una línea dominante', () => {
    expect(dominantPlayedGroup(['F', 'F'], 'MF')).toBe('MF');
    expect(dominantPlayedGroup(['F', 'M', 'F', 'M'], 'MF')).toBe('MF');
  });

  it('ignora partidos sin demarcación publicada', () => {
    expect(dominantPlayedGroup([null, 'D', 'D', null, 'D'], 'MF')).toBe('DF');
    expect(dominantPlayedGroup([null, null], null)).toBeNull();
  });
});
