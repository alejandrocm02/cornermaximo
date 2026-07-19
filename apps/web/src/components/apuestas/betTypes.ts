/**
 * Tipos y persistencia local del creador de apuestas simuladas.
 * Los datos se guardan únicamente en localStorage de este navegador:
 * no hay dinero real, ni pagos, ni cuentas de casas de apuestas.
 */
import type { BetSelection, BetStatus, SelectionOutcome } from '@futstats/stats';

export interface StoredSelection extends BetSelection {
  outcome: SelectionOutcome;
}

export interface SavedBet {
  id: string;
  name: string;
  createdAt: string; // ISO
  type: 'SIMPLE' | 'COMBINADA';
  selections: StoredSelection[];
  /** Importe simulado en euros; null si no se indicó. */
  stake: number | null;
  /** Cuota total en el momento de guardar (no se modifica retrospectivamente). */
  totalOdds: number;
  status: BetStatus;
  notes: string;
}

export const SLIP_KEY = 'futstats.cupon.v1';
export const BETS_KEY = 'futstats.apuestas.v1';

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // almacenamiento lleno o bloqueado: la app sigue funcionando en memoria
  }
}

export const BET_STATUS_LABELS: Record<BetStatus, { label: string; prefix: string; className: string }> = {
  BORRADOR: { label: 'Borrador', prefix: '✎', className: 'bg-pitch-border/60 text-pitch-muted' },
  PENDIENTE: { label: 'Pendiente', prefix: '…', className: 'bg-sky-500/15 text-sky-300' },
  GANADA: { label: 'Ganada', prefix: '✓', className: 'bg-pitch-accent/15 text-pitch-accent' },
  PERDIDA: { label: 'Perdida', prefix: '✕', className: 'bg-pitch-danger/15 text-pitch-danger' },
  ANULADA: { label: 'Anulada', prefix: '⊘', className: 'bg-pitch-border/60 text-pitch-muted' },
  PARCIALMENTE_ANULADA: { label: 'Parcialmente anulada', prefix: '⊘', className: 'bg-yellow-500/15 text-yellow-300' },
};

export const OUTCOME_LABELS: Record<SelectionOutcome, { label: string; prefix: string; className: string }> = {
  GANADA: { label: 'Acertada', prefix: '✓', className: 'text-pitch-accent' },
  PERDIDA: { label: 'Fallada', prefix: '✕', className: 'text-pitch-danger' },
  PENDIENTE: { label: 'Pendiente', prefix: '…', className: 'text-pitch-muted' },
  ANULADA: { label: 'Anulada', prefix: '⊘', className: 'text-pitch-muted' },
};

export const RESPONSIBLE_NOTICE =
  'Las apuestas implican riesgo y pueden provocar pérdidas económicas. Esta herramienta es únicamente informativa y no ejecuta apuestas con dinero real.';
