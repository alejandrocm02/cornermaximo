import { describe, expect, it } from 'vitest';
import {
  ALL_TRACKED_SEASONS,
  CALENDAR_YEAR_SEASONS,
  currentSeasonOf,
  EXPANSION_CANDIDATES,
  formatSeasonLabel,
  previousSeasonOf,
  seasonFormatOf,
  seasonLabelOf,
  seasonsOf,
  SPLIT_YEAR_SEASONS,
  TRACKED_COMPETITIONS,
  trackedCompetition,
} from '../src/index';

describe('formatSeasonLabel', () => {
  it('muestra las temporadas partidas como año de inicio y siguiente', () => {
    expect(formatSeasonLabel(2025, 'SPLIT_YEAR')).toBe('2025/26');
    expect(formatSeasonLabel(2026, 'SPLIT_YEAR')).toBe('2026/27');
  });

  it('rellena con cero al cruzar de siglo', () => {
    expect(formatSeasonLabel(1999, 'SPLIT_YEAR')).toBe('1999/00');
    expect(formatSeasonLabel(2009, 'SPLIT_YEAR')).toBe('2009/10');
  });

  it('muestra las temporadas de año natural como un único año', () => {
    expect(formatSeasonLabel(2026, 'CALENDAR_YEAR')).toBe('2026');
  });
});

describe('resolución por competición', () => {
  it('las 5 grandes ligas son de temporada partida', () => {
    for (const slug of ['laliga', 'premier-league', 'serie-a', 'bundesliga', 'ligue-1']) {
      expect(seasonFormatOf(slug)).toBe('SPLIT_YEAR');
      expect(seasonLabelOf(slug, 2025)).toBe('2025/26');
    }
  });

  it('asume temporada partida para competiciones desconocidas', () => {
    expect(seasonFormatOf('liga-que-no-existe')).toBe('SPLIT_YEAR');
    expect(seasonsOf('liga-que-no-existe')).toEqual(SPLIT_YEAR_SEASONS);
  });

  it('devuelve null para competiciones no rastreadas', () => {
    expect(trackedCompetition('laliga')).not.toBeNull();
    expect(trackedCompetition('mls')).toBeNull();
  });

  it('la temporada actual es la más reciente de las rastreadas', () => {
    expect(currentSeasonOf('laliga')).toBe(2026);
    expect(previousSeasonOf('laliga')).toBe(2025);
  });

  it('no hay temporada previa cuando solo se rastrea una', () => {
    expect(seasonsOf('mundial-2026')).toHaveLength(1);
    expect(previousSeasonOf('mundial-2026')).toBeNull();
  });
});

describe('ALL_TRACKED_SEASONS', () => {
  it('no repite años y va de más reciente a más antiguo', () => {
    expect(ALL_TRACKED_SEASONS).toEqual([...new Set(ALL_TRACKED_SEASONS)]);
    const descendente = [...ALL_TRACKED_SEASONS].sort((a, b) => b - a);
    expect(ALL_TRACKED_SEASONS).toEqual(descendente);
  });

  it('cubre todas las temporadas de todas las competiciones rastreadas', () => {
    for (const comp of TRACKED_COMPETITIONS) {
      for (const year of comp.seasons) {
        expect(ALL_TRACKED_SEASONS).toContain(year);
      }
    }
  });
});

describe('ligas añadidas en la ampliación', () => {
  const nuevas = ['laliga-2', 'championship', 'primeira-liga', 'eredivisie', 'super-lig'];

  it('las 5 están rastreadas y son de temporada partida', () => {
    for (const slug of nuevas) {
      const comp = trackedCompetition(slug);
      expect(comp, `falta ${slug} en TRACKED_COMPETITIONS`).not.toBeNull();
      expect(comp!.seasonFormat).toBe('SPLIT_YEAR');
      expect(comp!.type).toBe('LEAGUE');
      expect(comp!.seasons).toEqual(SPLIT_YEAR_SEASONS);
    }
  });

  it('ya no aparecen en el catálogo de candidatas', () => {
    for (const slug of nuevas) {
      expect(EXPANSION_CANDIDATES.find((c) => c.slug === slug)).toBeUndefined();
    }
  });

  it('la plataforma sincroniza 11 competiciones', () => {
    expect(TRACKED_COMPETITIONS).toHaveLength(11);
    expect(TRACKED_COMPETITIONS.filter((c) => c.type === 'LEAGUE')).toHaveLength(10);
    expect(TRACKED_COMPETITIONS.filter((c) => c.type === 'CUP')).toHaveLength(1);
  });
});

describe('catálogo de ampliación', () => {
  const todas = [...TRACKED_COMPETITIONS, ...EXPANSION_CANDIDATES];

  it('no hay slugs duplicados entre activas y candidatas', () => {
    const slugs = todas.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  // Un id repetido sincronizaría dos veces la misma competición bajo dos slugs,
  // duplicando equipos y partidos en base de datos.
  it('no hay ids de API-Football duplicados', () => {
    const ids = todas.map((c) => c.apiFootballId);
    const duplicados = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicados).toEqual([]);
  });

  it('las candidatas de año natural se etiquetan sin barra', () => {
    const calendario = EXPANSION_CANDIDATES.filter((c) => c.seasonFormat === 'CALENDAR_YEAR');
    expect(calendario.length).toBeGreaterThan(0);
    for (const comp of calendario) {
      expect(comp.seasons).toEqual(CALENDAR_YEAR_SEASONS);
      expect(formatSeasonLabel(comp.seasons[0]!, comp.seasonFormat)).not.toContain('/');
    }
  });

  it('Eliteserien y Allsvenskan son de año natural', () => {
    for (const slug of ['eliteserien', 'allsvenskan']) {
      const comp = EXPANSION_CANDIDATES.find((c) => c.slug === slug);
      expect(comp?.seasonFormat).toBe('CALENDAR_YEAR');
    }
  });

  it('toda candidata declara al menos una temporada', () => {
    for (const comp of EXPANSION_CANDIDATES) {
      expect(comp.seasons.length).toBeGreaterThan(0);
    }
  });
});
