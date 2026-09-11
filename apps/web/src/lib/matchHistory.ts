/** Presentation and calculations for a filtered, bounded player match history. */
export type HistorySearchParams = Record<string, string | string[] | undefined>;

export interface HistoryFilters {
  count: 5 | 10 | 20;
  year: number | null;
  competitionId: number | null;
  venue: 'all' | 'home' | 'away';
}

export function parseHistoryFilters(params: HistorySearchParams): HistoryFilters {
  const positiveInt = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d{1,9}$/.test(value)) return null;
    const number = Number(value);
    return number > 0 ? number : null;
  };
  const year = positiveInt(params.temporada);
  return {
    count: params.partidos === '20' ? 20 : params.partidos === '10' ? 10 : 5,
    year: year != null && year >= 1900 && year <= 2100 ? year : null,
    competitionId: positiveInt(params.competicion),
    venue: params.sede === 'home' || params.sede === 'away' ? params.sede : 'all',
  };
}

export interface HistoryTeam {
  name: string;
  crestUrl: string | null;
  goals: number | null;
}

export const FIELD_METRICS = [
  { key: 'goals', label: 'Goles', group: 'Ataque' },
  { key: 'assists', label: 'Asistencias', group: 'Ataque' },
  { key: 'shotsTotal', label: 'Tiros totales', group: 'Ataque' },
  { key: 'shotsOnTarget', label: 'Tiros a puerta', group: 'Ataque' },
  { key: 'passesAttempted', label: 'Pases intentados', group: 'Distribución' },
  { key: 'passesCompleted', label: 'Pases completados', group: 'Distribución' },
  { key: 'keyPasses', label: 'Pases clave', group: 'Distribución' },
  { key: 'tackles', label: 'Entradas', group: 'Defensa y disciplina' },
  { key: 'interceptions', label: 'Intercepciones', group: 'Defensa y disciplina' },
  { key: 'duelsWon', label: 'Duelos ganados', group: 'Defensa y disciplina' },
  { key: 'foulsCommitted', label: 'Faltas cometidas', group: 'Defensa y disciplina' },
  { key: 'foulsDrawn', label: 'Faltas recibidas', group: 'Defensa y disciplina' },
  { key: 'yellowCards', label: 'Tarjetas amarillas', group: 'Defensa y disciplina' },
  { key: 'redCards', label: 'Tarjetas rojas', group: 'Defensa y disciplina' },
] as const;

export const GOALKEEPER_METRICS = [
  { key: 'saves', label: 'Paradas', group: 'Portería' },
  { key: 'goalsConceded', label: 'Goles encajados', group: 'Portería' },
  { key: 'penaltiesSaved', label: 'Penaltis parados', group: 'Portería' },
] as const;

export type HistoryMetricKey = typeof FIELD_METRICS[number]['key'] | typeof GOALKEEPER_METRICS[number]['key'];

export interface HistoryMatch {
  id: number;
  date: string;
  competition: string;
  season: string;
  round: string | null;
  isHome: boolean;
  home: HistoryTeam;
  away: HistoryTeam;
  minutes: number;
  role: string;
  position: string | null;
  rating: number | null;
  stats: Partial<Record<HistoryMetricKey, number | null>>;
}

/** Missing values and unused bench appearances never dilute a metric's sample. */
export function summarizeHistoryMetric(matches: HistoryMatch[], key: HistoryMetricKey) {
  const sample = matches.filter((match) => match.minutes > 0 && match.stats[key] != null);
  if (!sample.length) return { average: null, per90: null, sample: 0 };
  const total = sample.reduce((sum, match) => sum + match.stats[key]!, 0);
  const minutes = sample.reduce((sum, match) => sum + match.minutes, 0);
  return { average: total / sample.length, per90: total * 90 / minutes, sample: sample.length };
}

export function historyParticipation(match: HistoryMatch): string {
  if (match.role === 'NOT_CALLED') return 'No convocado';
  if (match.role === 'BENCH_UNUSED') return 'Sin participar';
  if (match.role === 'STARTER') return 'Titular';
  return match.minutes > 0 ? 'Suplente' : 'Sin participar';
}

export function historyPosition(position: string | null): string {
  const labels: Record<string, string> = {
    G: 'Portero', GK: 'Portero', D: 'Defensa', DF: 'Defensa',
    M: 'Medio', MF: 'Medio', F: 'Delantero', FW: 'Delantero',
  };
  return position ? labels[position] ?? position : '—';
}
