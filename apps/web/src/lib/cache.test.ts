import { describe, expect, it } from 'vitest';
import { FOOTBALL_DATA_CACHE_TAG, liveInvalidationTags, MATCHES_CACHE_TAG } from './cache';

describe('liveInvalidationTags', () => {
  it('no invalida nada si el refresco no trajo cambios', () => {
    expect(liveInvalidationTags({ matchDataChanged: false, matchFinished: false })).toEqual([]);
  });

  it('durante el partido solo invalida las vistas de partidos', () => {
    expect(liveInvalidationTags({ matchDataChanged: true, matchFinished: false })).toEqual([MATCHES_CACHE_TAG]);
  });

  it('al terminar un partido invalida también fichas y rankings', () => {
    expect(liveInvalidationTags({ matchDataChanged: true, matchFinished: true })).toEqual([
      MATCHES_CACHE_TAG,
      FOOTBALL_DATA_CACHE_TAG,
    ]);
  });
});
