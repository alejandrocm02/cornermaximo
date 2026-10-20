/**
 * Presentación en español de los eventos de partido de API-Football.
 *
 * El proveedor guarda el detalle en inglés ("Yellow Card · Foul", "Normal
 * Goal", "Substitution 3"). Aquí se convierte en un título y una nota en
 * español; lo que no se reconoce no se muestra, para no mezclar idiomas.
 *
 * En los cambios, `player` es el jugador que SALE y `assist` el que ENTRA
 * (comprobado con 35.000 cambios: el primero es titular y el segundo suplente).
 */

const EVENT_TITLE: Record<string, string> = {
  GOAL: 'Gol',
  OWN_GOAL: 'Gol en propia puerta',
  PENALTY_GOAL: 'Gol de penalti',
  MISSED_PENALTY: 'Penalti fallado',
  YELLOW_CARD: 'Tarjeta amarilla',
  SECOND_YELLOW: 'Segunda amarilla',
  RED_CARD: 'Tarjeta roja',
  SUBSTITUTION: 'Cambio',
  VAR: 'VAR',
};

/** Motivo de una tarjeta (comentario del proveedor), en minúsculas. */
const CARD_REASON: Record<string, string> = {
  foul: 'Falta',
  argument: 'Protestas',
  dissent: 'Protestas',
  'time wasting': 'Pérdida de tiempo',
  simulation: 'Simulación',
  diving: 'Simulación',
  handball: 'Mano',
  'professional handball': 'Mano para evitar una ocasión',
  'persistent fouling': 'Faltas reiteradas',
  'persistent infringement': 'Faltas reiteradas',
  'off the ball foul': 'Falta sin balón',
  'professional foul last man': 'Falta como último defensor',
  'violent conduct': 'Conducta violenta',
  'serious foul': 'Juego brusco grave',
  roughing: 'Juego brusco',
  'dangerous play': 'Juego peligroso',
  'unallowed field entering': 'Entrar al campo sin permiso',
  tripping: 'Zancadilla',
  holding: 'Agarrón',
  'not retreating': 'No respetar la distancia',
  'unsportsmanlike conduct': 'Conducta antideportiva',
  'unsporting behaviour': 'Conducta antideportiva',
  'abusive language': 'Lenguaje ofensivo',
  'rescinded card': 'Tarjeta retirada',
};

/** Decisión del VAR (detalle del proveedor), en minúsculas. */
const VAR_DECISION: Record<string, string> = {
  'goal cancelled': 'Gol anulado',
  'goal disallowed - offside': 'Gol anulado por fuera de juego',
  'goal confirmed': 'Gol confirmado',
  'penalty confirmed': 'Penalti confirmado',
  'penalty cancelled': 'Penalti anulado',
  'card upgrade': 'Tarjeta revisada al alza',
  'card upgrade confirmed': 'Tarjeta revisada al alza',
  'card reviewed': 'Tarjeta revisada',
  'red card cancelled': 'Roja anulada',
  'original decision changed': 'Decisión rectificada',
};

export interface EventDescription {
  title: string;
  /** Aclaración en español, o `null` si el detalle no aporta nada o no se reconoce. */
  note: string | null;
  /** Etiqueta del jugador principal y del secundario según el tipo de evento. */
  playerLabel: string | null;
  secondaryLabel: string | null;
}

function parts(detail: string | null): { base: string; comment: string } {
  const [base = '', comment = ''] = (detail ?? '').split(' · ');
  return { base: base.trim().toLowerCase(), comment: comment.trim().toLowerCase() };
}

export function describeMatchEvent(type: string, detail: string | null): EventDescription {
  const { base, comment } = parts(detail);
  const shootout = comment === 'penalty shootout' ? 'Tanda de penaltis' : null;

  switch (type) {
    case 'SUBSTITUTION': {
      const number = base.match(/^substitution (\d+)$/)?.[1];
      return {
        title: number != null ? `Cambio ${number}` : EVENT_TITLE.SUBSTITUTION!,
        note: null,
        playerLabel: 'Sale',
        secondaryLabel: 'Entra',
      };
    }
    case 'YELLOW_CARD':
    case 'SECOND_YELLOW':
    case 'RED_CARD':
      return { title: EVENT_TITLE[type]!, note: CARD_REASON[comment] ?? null, playerLabel: null, secondaryLabel: null };
    case 'VAR': {
      const decision = VAR_DECISION[base];
      return { title: decision != null ? `VAR · ${decision}` : 'Revisión del VAR', note: null, playerLabel: null, secondaryLabel: null };
    }
    case 'GOAL':
    case 'OWN_GOAL':
    case 'PENALTY_GOAL':
      return { title: EVENT_TITLE[type]!, note: shootout, playerLabel: null, secondaryLabel: type === 'GOAL' ? 'Asistencia de' : null };
    case 'MISSED_PENALTY':
      return { title: EVENT_TITLE[type]!, note: shootout, playerLabel: null, secondaryLabel: null };
    default:
      return { title: EVENT_TITLE[type] ?? 'Evento', note: null, playerLabel: null, secondaryLabel: null };
  }
}
