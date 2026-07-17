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
