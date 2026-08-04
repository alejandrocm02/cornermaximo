export interface SeasonSnapshot {
  id: number;
  competitionId: number;
  year: number;
  isCurrent: boolean;
}

export interface SeasonTeamSnapshot {
  seasonId: number;
  teamId: number;
}

export interface StandingSnapshot {
  seasonId: number;
  teamId: number;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface MatchSnapshot {
  id: number;
  seasonId: number;
  status: string;
  kickoffAt: Date;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface DataQualityIssue {
  code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  entityIds: number[];
}

export function validateCurrentSeasons(seasons: SeasonSnapshot[]): DataQualityIssue[] {
  const byCompetition = new Map<number, SeasonSnapshot[]>();
  for (const season of seasons.filter((item) => item.isCurrent)) {
    const rows = byCompetition.get(season.competitionId) ?? [];
    rows.push(season);
    byCompetition.set(season.competitionId, rows);
  }
  return [...byCompetition.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([competitionId, rows]) => ({
      code: 'MULTIPLE_CURRENT_SEASONS',
      severity: 'ERROR' as const,
      message: `La competición ${competitionId} tiene ${rows.length} temporadas vigentes.`,
      entityIds: rows.map((row) => row.id),
    }));
}

export function validateSeasonTeams(rows: SeasonTeamSnapshot[]): DataQualityIssue[] {
  const seen = new Set<string>();
  const issues: DataQualityIssue[] = [];
  for (const row of rows) {
    const key = `${row.seasonId}:${row.teamId}`;
    if (seen.has(key)) {
      issues.push({
        code: 'DUPLICATE_SEASON_TEAM',
        severity: 'ERROR',
        message: `El equipo ${row.teamId} está duplicado en la temporada ${row.seasonId}.`,
        entityIds: [row.seasonId, row.teamId],
      });
    }
    seen.add(key);
  }
  return issues;
}

export function validateStandings(rows: StandingSnapshot[]): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const bySeason = new Map<number, StandingSnapshot[]>();
  for (const row of rows) {
    const seasonRows = bySeason.get(row.seasonId) ?? [];
    seasonRows.push(row);
    bySeason.set(row.seasonId, seasonRows);
    if (row.played !== row.won + row.drawn + row.lost) {
      issues.push({
        code: 'STANDING_PLAYED_MISMATCH',
        severity: 'ERROR',
        message: `PJ no coincide con G+E+P para el equipo ${row.teamId}.`,
        entityIds: [row.seasonId, row.teamId],
      });
    }
    if ([row.position, row.played, row.won, row.drawn, row.lost, row.goalsFor, row.goalsAgainst, row.points].some((value) => value < 0)) {
      issues.push({
        code: 'NEGATIVE_STANDING_VALUE',
        severity: 'ERROR',
        message: `La clasificación contiene valores negativos para el equipo ${row.teamId}.`,
        entityIds: [row.seasonId, row.teamId],
      });
    }
  }
  for (const [seasonId, seasonRows] of bySeason) {
    const positions = new Map<number, number[]>();
    for (const row of seasonRows) {
      const teams = positions.get(row.position) ?? [];
      teams.push(row.teamId);
      positions.set(row.position, teams);
    }
    for (const [position, teams] of positions) {
      if (teams.length > 1) {
        issues.push({
          code: 'DUPLICATE_STANDING_POSITION',
          severity: 'WARNING',
          message: `La posición ${position} está repetida en la temporada ${seasonId}.`,
          entityIds: [seasonId, ...teams],
        });
      }
    }
  }
  return issues;
}

export function validateMatches(matches: MatchSnapshot[], now = new Date()): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  for (const match of matches) {
    if (match.homeTeamId == null || match.awayTeamId == null) {
      issues.push({ code: 'MATCH_MISSING_TEAM', severity: 'ERROR', message: `El partido ${match.id} no tiene ambos equipos.`, entityIds: [match.id] });
    } else if (match.homeTeamId === match.awayTeamId) {
      issues.push({ code: 'MATCH_SAME_TEAM', severity: 'ERROR', message: `El partido ${match.id} enfrenta al mismo equipo.`, entityIds: [match.id, match.homeTeamId] });
    }
    if (match.status === 'FINISHED' && (match.homeGoals == null || match.awayGoals == null)) {
      issues.push({ code: 'FINISHED_WITHOUT_SCORE', severity: 'ERROR', message: `El partido finalizado ${match.id} no tiene marcador completo.`, entityIds: [match.id] });
    }
    if (match.status === 'SCHEDULED' && match.kickoffAt.getTime() < now.getTime() - 6 * 60 * 60 * 1000) {
      issues.push({ code: 'OVERDUE_SCHEDULED_MATCH', severity: 'WARNING', message: `El partido ${match.id} sigue programado después de su hora.`, entityIds: [match.id] });
    }
  }
  return issues;
}

export function validateDataSnapshot(input: {
  seasons: SeasonSnapshot[];
  seasonTeams: SeasonTeamSnapshot[];
  standings: StandingSnapshot[];
  matches: MatchSnapshot[];
  now?: Date;
}): DataQualityIssue[] {
  return [
    ...validateCurrentSeasons(input.seasons),
    ...validateSeasonTeams(input.seasonTeams),
    ...validateStandings(input.standings),
    ...validateMatches(input.matches, input.now),
  ];
}
