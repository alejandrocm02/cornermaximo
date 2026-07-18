import type { MatchStatus } from '@futstats/shared';

export function seasonLabel(year: number): string {
  return `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
}

export function formatMatchDate(date: Date): string {
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function statusLabel(status: MatchStatus): string {
  const labels: Record<MatchStatus, string> = {
    SCHEDULED: 'Programado',
    LIVE: 'En juego',
    FINISHED: 'Finalizado',
    POSTPONED: 'Aplazado',
    SUSPENDED: 'Suspendido',
    ABANDONED: 'Abandonado',
    CANCELLED: 'Cancelado',
  };
  return labels[status];
}

const ROUND_ES: Record<string, string> = {
  'Round of 16': 'Octavos de final',
  'Quarter-finals': 'Cuartos de final',
  'Semi-finals': 'Semifinales',
  '3rd Place Final': 'Partido por el tercer puesto',
  Final: 'Final',
};

/** Traduce el nombre de ronda del proveedor ("Semi-finals", "Regular Season - 3"...). */
export function roundLabel(round: string | null): string | null {
  if (round == null) return null;
  const jornada = round.match(/^Regular Season - (\d+)$/);
  if (jornada != null) return `Jornada ${jornada[1]}`;
  const grupo = round.match(/^Group Stage - (\d+)$/);
  if (grupo != null) return `Fase de grupos · Jornada ${grupo[1]}`;
  return ROUND_ES[round] ?? round;
}

/** "Group A" -> "Grupo A"; "Group Stage" (ranking de terceros) -> etiqueta propia */
export function groupLabel(group: string): string {
  if (group === 'Group Stage') return 'Mejores terceros';
  return group.replace(/^Group /, 'Grupo ');
}
