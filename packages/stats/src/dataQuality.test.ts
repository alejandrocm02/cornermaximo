import { describe, expect, it } from 'vitest';
import {
  validateCurrentSeasons,
  validateDataSnapshot,
  validateMatches,
  validateStandings,
} from './dataQuality';

describe('integridad de temporadas', () => {
  it('detecta más de una temporada vigente por competición', () => {
    const issues = validateCurrentSeasons([
      { id: 1, competitionId: 10, year: 2025, isCurrent: true },
      { id: 2, competitionId: 10, year: 2026, isCurrent: true },
      { id: 3, competitionId: 11, year: 2026, isCurrent: true },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('MULTIPLE_CURRENT_SEASONS');
    expect(issues[0]?.entityIds).toEqual([1, 2]);
  });
});

describe('integridad de clasificaciones', () => {
  it('detecta incoherencia entre PJ y G+E+P', () => {
    const issues = validateStandings([
      { seasonId: 1, teamId: 5, position: 1, played: 10, won: 7, drawn: 2, lost: 0, goalsFor: 20, goalsAgainst: 8, points: 23 },
    ]);
    expect(issues.some((issue) => issue.code === 'STANDING_PLAYED_MISMATCH')).toBe(true);
  });

  it('detecta posiciones duplicadas', () => {
    const issues = validateStandings([
      { seasonId: 1, teamId: 5, position: 1, played: 10, won: 7, drawn: 2, lost: 1, goalsFor: 20, goalsAgainst: 8, points: 23 },
      { seasonId: 1, teamId: 6, position: 1, played: 10, won: 6, drawn: 3, lost: 1, goalsFor: 18, goalsAgainst: 9, points: 21 },
    ]);
    expect(issues.some((issue) => issue.code === 'DUPLICATE_STANDING_POSITION')).toBe(true);
  });
});

describe('integridad de partidos', () => {
  it('detecta finalizados sin marcador y equipos repetidos', () => {
    const issues = validateMatches([
      { id: 20, seasonId: 1, status: 'FINISHED', kickoffAt: new Date('2026-08-01T18:00:00Z'), homeTeamId: 8, awayTeamId: 8, homeGoals: null, awayGoals: 1 },
    ], new Date('2026-08-04T18:00:00Z'));
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['MATCH_SAME_TEAM', 'FINISHED_WITHOUT_SCORE']));
  });

  it('avisa de partidos vencidos que siguen programados', () => {
    const issues = validateMatches([
      { id: 21, seasonId: 1, status: 'SCHEDULED', kickoffAt: new Date('2026-08-03T10:00:00Z'), homeTeamId: 8, awayTeamId: 9, homeGoals: null, awayGoals: null },
    ], new Date('2026-08-04T18:00:00Z'));
    expect(issues.some((issue) => issue.code === 'OVERDUE_SCHEDULED_MATCH')).toBe(true);
  });
});

describe('snapshot completo', () => {
  it('acepta un conjunto coherente', () => {
    const issues = validateDataSnapshot({
      seasons: [{ id: 1, competitionId: 10, year: 2026, isCurrent: true }],
      seasonTeams: [{ seasonId: 1, teamId: 5 }, { seasonId: 1, teamId: 6 }],
      standings: [
        { seasonId: 1, teamId: 5, position: 1, played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, points: 3 },
        { seasonId: 1, teamId: 6, position: 2, played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, points: 0 },
      ],
      matches: [{ id: 1, seasonId: 1, status: 'FINISHED', kickoffAt: new Date('2026-08-01T18:00:00Z'), homeTeamId: 5, awayTeamId: 6, homeGoals: 2, awayGoals: 0 }],
      now: new Date('2026-08-04T18:00:00Z'),
    });
    expect(issues).toEqual([]);
  });
});
