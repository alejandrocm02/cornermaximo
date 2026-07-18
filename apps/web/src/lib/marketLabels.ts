/**
 * Etiquetas del mercado: categorías de noticias, tipos de operación y estados.
 * Cada estado tiene texto, estilo e ícono/explicación: nunca solo color.
 * Solo se usan estados que los datos pueden respaldar con una fuente.
 */

export const CATEGORY_LABELS: Record<string, string> = {
  'ultima-hora': 'Última hora',
  fichajes: 'Fichajes',
  rumores: 'Rumores',
  confirmados: 'Confirmados',
  lesiones: 'Lesiones',
  renovaciones: 'Renovaciones',
  competiciones: 'Competiciones',
  'mundial-2026': 'Mundial 2026',
};

export interface StatusInfo {
  label: string;
  /** Prefijo textual para no depender del color. */
  prefix: string;
  className: string;
  explanation: string;
}

/** Estados de una operación. Los no respaldados aún por datos quedan definidos para el futuro. */
export const TRANSFER_STATUS: Record<string, StatusInfo> = {
  CONFIRMADO: {
    label: 'Confirmado',
    prefix: '✓',
    className: 'bg-pitch-accent/15 text-pitch-accent',
    explanation: 'Movimiento registrado por el proveedor de datos como hecho consumado.',
  },
  OFICIAL: {
    label: 'Oficial',
    prefix: '✓✓',
    className: 'bg-pitch-accent/25 text-pitch-accent',
    explanation: 'Anunciado por el club o la competición en sus canales oficiales.',
  },
  RUMOR: {
    label: 'Rumor',
    prefix: '?',
    className: 'bg-yellow-500/15 text-yellow-300',
    explanation: 'Información no confirmada publicada por un medio; puede no concretarse.',
  },
  NEGOCIACION: {
    label: 'Negociación',
    prefix: '…',
    className: 'bg-yellow-500/15 text-yellow-300',
    explanation: 'Conversaciones en curso según la fuente citada.',
  },
  OFERTA: { label: 'Oferta presentada', prefix: '→', className: 'bg-yellow-500/15 text-yellow-300', explanation: 'Oferta formal comunicada por la fuente citada.' },
  ACUERDO_VERBAL: { label: 'Acuerdo verbal', prefix: '≈', className: 'bg-yellow-500/15 text-yellow-300', explanation: 'Acuerdo no firmado según la fuente citada.' },
  RECONOCIMIENTO_MEDICO: { label: 'Reconocimiento médico', prefix: '+', className: 'bg-sky-500/15 text-sky-300', explanation: 'El jugador pasa las pruebas médicas previas a la firma.' },
  CESION: { label: 'Cesión', prefix: '⇄', className: 'bg-sky-500/15 text-sky-300', explanation: 'Traslado temporal a otro club.' },
  RENOVACION: { label: 'Renovación', prefix: '↻', className: 'bg-pitch-accent/15 text-pitch-accent', explanation: 'Ampliación de contrato con su club actual.' },
  CANCELADO: { label: 'Operación cancelada', prefix: '✕', className: 'bg-pitch-danger/15 text-pitch-danger', explanation: 'La operación no llegó a completarse.' },
};

export const TRANSFER_TYPE_LABELS: Record<string, string> = {
  TRASPASO: 'Traspaso',
  CESION: 'Cesión',
  AGENTE_LIBRE: 'Agente libre',
  REGRESO_CESION: 'Regreso de cesión',
  RENOVACION: 'Renovación',
  RESCISION: 'Rescisión',
  DESCONOCIDO: 'Movimiento',
};

/** Cómo mostrar el coste sin presentar estimaciones como cifras oficiales. */
export function feeLabel(fee: string | null): { text: string; note: string } {
  if (fee == null || fee === '') return { text: 'No revelado', note: '' };
  return { text: fee, note: 'Cantidad reportada por el proveedor' };
}

export function timeAgo(date: Date): string {
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return 'hace menos de un minuto';
  if (mins < 60) return `hace ${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}
