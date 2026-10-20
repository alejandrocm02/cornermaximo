import { describe, expect, it, vi } from 'vitest';

vi.mock('@cornermaximo/db', () => ({ prisma: {} }));

const { groupMatchesByRound, leaguePhaseZone, selectRound } = await import('./uefaCompetition');
const { competitionHref, isUefaClubCompetition } = await import('./competitionLinks');
const { roundLabel } = await import('./football');

const match = (id: number, round: string, day: number, status = 'FINISHED') => ({
  id,
  round,
  kickoffAt: new Date(Date.UTC(2026, 9, day, 19)),
  status,
  teams: [],
});

describe('leaguePhaseZone', () => {
  it('reparte los 36 puestos de la fase de liga', () => {
    expect(leaguePhaseZone(1)).toBe('ROUND_OF_16');
    expect(leaguePhaseZone(8)).toBe('ROUND_OF_16');
    expect(leaguePhaseZone(9)).toBe('PLAYOFF');
    expect(leaguePhaseZone(24)).toBe('PLAYOFF');
    expect(leaguePhaseZone(25)).toBe('ELIMINATED');
    expect(leaguePhaseZone(36)).toBe('ELIMINATED');
  });
});

describe('groupMatchesByRound y selectRound', () => {
  const rounds = groupMatchesByRound([
    match(3, 'League Stage - 3', 21, 'SCHEDULED'),
    match(1, 'League Stage - 1', 7),
    match(2, 'League Stage - 2', 14),
    match(4, 'League Stage - 3', 22, 'SCHEDULED'),
  ]);

  it('ordena las rondas por fecha', () => {
    expect(rounds.map((round) => round.round)).toEqual(['League Stage - 1', 'League Stage - 2', 'League Stage - 3']);
    expect(rounds[2]!.matches.map((m) => m.id)).toEqual([3, 4]);
  });

  it('muestra por defecto la primera ronda con partidos pendientes', () => {
    expect(selectRound(rounds, undefined)?.round).toBe('League Stage - 3');
  });

  it('respeta la ronda pedida y descarta una inexistente', () => {
    expect(selectRound(rounds, 'League Stage - 1')?.round).toBe('League Stage - 1');
    expect(selectRound(rounds, 'Final')?.round).toBe('League Stage - 3');
  });

  it('con todo jugado muestra la última', () => {
    const played = groupMatchesByRound([match(1, 'League Stage - 1', 7), match(2, 'Final', 30)]);
    expect(selectRound(played, undefined)?.round).toBe('Final');
    expect(selectRound([], undefined)).toBeNull();
  });
});

describe('roundLabel de competiciones UEFA', () => {
  it('traduce la fase de liga y las eliminatorias', () => {
    expect(roundLabel('League Stage - 3')).toBe('Fase de liga · Jornada 3');
    expect(roundLabel('Knockout Round Play-offs')).toBe('Play-off de eliminatorias');
    expect(roundLabel('Round of 16')).toBe('Octavos de final');
    expect(roundLabel('Regular Season - 9')).toBe('Jornada 9');
  });
});

describe('competitionHref', () => {
  it('enlaza ligas y copas UEFA a /ligas y el Mundial a su sección', () => {
    expect(competitionHref({ slug: 'laliga', type: 'LEAGUE' })).toBe('/ligas/laliga');
    expect(competitionHref({ slug: 'champions-league', type: 'CUP' })).toBe('/ligas/champions-league');
    expect(competitionHref({ slug: 'mundial-2026', type: 'CUP' })).toBe('/mundial-2026');
    expect(competitionHref({ slug: 'copa-del-rey', type: 'CUP' })).toBeNull();
  });

  it('reconoce las tres competiciones UEFA de clubes', () => {
    expect(['champions-league', 'europa-league', 'conference-league'].every(isUefaClubCompetition)).toBe(true);
    expect(isUefaClubCompetition('laliga')).toBe(false);
  });
});
