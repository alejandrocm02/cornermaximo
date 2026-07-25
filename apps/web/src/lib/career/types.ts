/**
 * Tipos del Modo Carrera ("Mi Carrera").
 * Juego narrativo local: todo se guarda en el dispositivo del usuario.
 * Los clubes y ligas son ficticios para no infringir licencias de terceros.
 */

export type Position = 'POR' | 'DFC' | 'LAT' | 'MC' | 'MCO' | 'EXT' | 'DEL';

export type Archetype =
  | 'goleador'
  | 'creador'
  | 'regateador'
  | 'organizador'
  | 'recuperador'
  | 'defensor'
  | 'reflejos'
  | 'completo';

export type Difficulty = 'facil' | 'normal' | 'dificil' | 'unaVida';

export type Foot = 'derecho' | 'izquierdo' | 'ambidiestro';

/** Atributos de campo (0-99). */
export type FieldAttr =
  | 'ritmo'
  | 'tecnica'
  | 'pase'
  | 'disparo'
  | 'regate'
  | 'defensa'
  | 'fisico'
  | 'vision'
  | 'concentracion'
  | 'resistencia';

/** Atributos de portero (0-99). */
export type GkAttr = 'reflejos' | 'colocacion' | 'blocaje' | 'aereo' | 'salida' | 'pies';

export type AttrKey = FieldAttr | GkAttr;

export type Attributes = Record<AttrKey, number>;

export type TrainingFocus =
  | 'finalizacion'
  | 'pase'
  | 'regate'
  | 'velocidad'
  | 'resistencia'
  | 'defensa'
  | 'fisico'
  | 'balonParado'
  | 'recuperacion';

export interface Club {
  id: string;
  name: string;
  short: string;
  league: string;
  country: string;
  /** 1 = modesto, 5 = élite mundial. */
  tier: 1 | 2 | 3 | 4 | 5;
  /** Fuerza deportiva 40-95. */
  strength: number;
}

export type ContractRole = 'canterano' | 'suplente' | 'rotacion' | 'titular' | 'estrella';

export interface Contract {
  clubId: string;
  yearsLeft: number;
  /** Salario semanal simulado en miles de euros. */
  salaryK: number;
  role: ContractRole;
}

export interface TransferOffer {
  id: string;
  club: Club;
  years: number;
  salaryK: number;
  role: ContractRole;
  /** Etiqueta de proyecto: minutos, prestigio, dinero, proyecto. */
  pitch: string;
  european: boolean;
}

export interface InjuryState {
  name: string;
  /** Jornadas restantes de baja. */
  weeksOut: number;
  /** Riesgo de recaída 0-1 si se fuerza. */
  relapseRisk: number;
  /** Si el usuario decidió jugar infiltrado. */
  playingThrough: boolean;
}

export type ObjectiveKind =
  | 'minutos'
  | 'goles'
  | 'asistencias'
  | 'porteriasCero'
  | 'valoracion'
  | 'titulo'
  | 'evitarDescenso'
  | 'clasificacionEuropea'
  | 'convocatoriaSeleccion';

export type ObjectiveLevel = 'minimo' | 'principal' | 'extraordinario';

export interface SeasonObjective {
  kind: ObjectiveKind;
  level: ObjectiveLevel;
  label: string;
  target: number;
  done: boolean;
}

export interface SeasonStats {
  pj: number;
  titularidades: number;
  minutos: number;
  goles: number;
  asistencias: number;
  tiros: number;
  pases: number;
  recuperaciones: number;
  paradas: number;
  porteriasCero: number;
  amarillas: number;
  rojas: number;
  ratingSum: number;
  ratingCount: number;
}

export interface SeasonSummary {
  year: number;
  age: number;
  clubName: string;
  league: string;
  division: number;
  stats: SeasonStats;
  avgRating: number;
  leaguePosition: number;
  titles: string[];
  objectivesMet: number;
  objectivesTotal: number;
}

export type NatLevel = 'ninguna' | 'sub21' | 'absoluta';

export interface NationalTeamState {
  /** Estado internacional: sin convocar, juvenil o absoluta. */
  level: NatLevel;
  /**
   * Federación que representa el jugador. Con doble nacionalidad se fija al
   * elegir federación o con la primera convocatoria; null hasta entonces.
   */
  teamCode: string | null;
  caps: number;
  goals: number;
  tournamentsWon: string[];
}

/** Situación clave dentro de un partido. */
export interface MatchMoment {
  id: string;
  minute: number;
  text: string;
  options: MatchOption[];
}

export interface MatchOption {
  id: string;
  label: string;
  /** Etiqueta de riesgo mostrada al usuario (sin porcentaje exacto). */
  risk: 'muyProbable' | 'probable' | 'arriesgado' | 'muyArriesgado';
  /** Probabilidad real de éxito calculada con los atributos. */
  successP: number;
  success: MomentEffect;
  failure: MomentEffect;
}

export interface MomentEffect {
  text: string;
  goles?: number;
  asistencias?: number;
  tiros?: number;
  paradas?: number;
  recuperaciones?: number;
  rating: number;
  moral: number;
  reputacion?: number;
  lesionP?: number;
  tarjetaP?: number;
}

export interface MatchResult {
  jornada: number;
  rival: string;
  rivalStrength: number;
  home: boolean;
  golesFavor: number;
  golesContra: number;
  titular: boolean;
  minutos: number;
  goles: number;
  asistencias: number;
  tiros: number;
  pases: number;
  recuperaciones: number;
  paradas: number;
  porteriaCero: boolean;
  amarilla: boolean;
  roja: boolean;
  rating: number;
  headline: string;
}

/** Evento narrativo fuera del campo. */
export interface NarrativeEvent {
  id: string;
  title: string;
  text: string;
  options: NarrativeOption[];
}

export interface NarrativeOption {
  id: string;
  label: string;
  hint: string;
  effects: NarrativeEffects;
}

export interface NarrativeEffects {
  moral?: number;
  forma?: number;
  fitness?: number;
  reputacion?: number;
  coachTrust?: number;
  salaryK?: number;
  devBoost?: number;
  injuryP?: number;
  /** Fija la federación del jugador (decisión de doble nacionalidad). */
  chooseNationalTeam?: 'principal' | 'secundaria';
  text: string;
}

export interface PlayerState {
  name: string;
  /** Código estable de la nacionalidad principal (ISO 3166-1 alpha-2 o GB-XXX). */
  primaryNationalityCode: string;
  /** Segunda nacionalidad opcional (mismo formato de código). */
  secondaryNationalityCode: string | null;
  age: number;
  position: Position;
  foot: Foot;
  heightCm: number;
  archetype: Archetype;
  attributes: Attributes;
  /** Potencial oculto 70-99 (tope de crecimiento). */
  potential: number;
  forma: number;
  moral: number;
  fitness: number;
  reputacion: number;
  coachTrust: number;
  /** Valor de mercado simulado en millones. */
  valueM: number;
  maxValueM: number;
}

export interface LogEntry {
  year: number;
  jornada: number;
  text: string;
  kind: 'partido' | 'evento' | 'contrato' | 'lesion' | 'seleccion' | 'logro' | 'temporada';
}

export type PendingScreen =
  | { type: 'jornada' }
  | { type: 'momento'; moment: MatchMoment; partial: MatchResult }
  | { type: 'resultado'; result: MatchResult; notes: string[] }
  | { type: 'evento'; event: NarrativeEvent }
  | { type: 'ofertas'; offers: TransferOffer[]; canStay: boolean; reason: string }
  | { type: 'finTemporada'; summary: SeasonSummary; notes: string[] }
  | { type: 'finCarrera' };

export interface CareerState {
  /** Versión del formato de guardado (v2: nacionalidades con código ISO). */
  v: 2;
  id: string;
  createdAt: string;
  seed: number;
  rngState: number;
  difficulty: Difficulty;
  year: number;
  seasonIndex: number;
  jornada: number;
  totalJornadas: number;
  /** Posición del equipo en la liga (aprox, 1-20). */
  leaguePos: number;
  player: PlayerState;
  club: Club;
  division: number;
  contract: Contract;
  training: TrainingFocus;
  stats: SeasonStats;
  careerTotals: SeasonStats;
  history: SeasonSummary[];
  objectives: SeasonObjective[];
  trophies: string[];
  achievements: string[];
  national: NationalTeamState;
  injury: InjuryState | null;
  log: LogEntry[];
  screen: PendingScreen;
  retired: boolean;
  retirementReason: string | null;
}

export interface CareerConfig {
  name: string;
  primaryNationalityCode: string;
  secondaryNationalityCode: string | null;
  age: number;
  position: Position;
  foot: Foot;
  heightCm: number;
  archetype: Archetype;
  startCountry: string;
  difficulty: Difficulty;
  seedText: string | null;
}

/** Resumen final para la tarjeta de carrera y el ranking local. */
export interface CareerCard {
  id: string;
  finishedAt: string;
  name: string;
  position: Position;
  /** Código estable de nacionalidad (para ranking por país y bandera). */
  countryCode: string;
  /** Nombre legible del país en el momento de generar la tarjeta. */
  countryName: string;
  /** Federación representada (puede diferir del país con doble nacionalidad). */
  nationalTeamCode: string | null;
  seasons: number;
  clubs: string[];
  pj: number;
  goles: number;
  asistencias: number;
  paradas: number;
  porteriasCero: number;
  avgRating: number;
  titles: string[];
  achievements: string[];
  caps: number;
  capGoals: number;
  maxValueM: number;
  records: string[];
  score: number;
  legendLevel: LegendLevel;
  difficulty: Difficulty;
  retirementReason: string;
}

export type LegendLevel = 'Profesional' | 'Referente' | 'Figura' | 'Ídolo' | 'Leyenda' | 'Leyenda mundial';

export const POSITION_LABELS: Record<Position, string> = {
  POR: 'Portero',
  DFC: 'Defensa central',
  LAT: 'Lateral',
  MC: 'Mediocentro',
  MCO: 'Mediapunta',
  EXT: 'Extremo',
  DEL: 'Delantero',
};

export const ARCHETYPE_LABELS: Record<Archetype, { label: string; desc: string }> = {
  goleador: { label: 'Goleador', desc: 'Definición letal, pero flojo en defensa y creación.' },
  creador: { label: 'Creador', desc: 'Visión y pase de élite; le falta punch físico.' },
  regateador: { label: 'Regateador', desc: 'Desborde y ritmo; pierde balones y defiende poco.' },
  organizador: { label: 'Organizador', desc: 'Orden, pase y concentración; poco desequilibrio.' },
  recuperador: { label: 'Recuperador', desc: 'Roba balones sin parar; técnica limitada.' },
  defensor: { label: 'Defensor', desc: 'Duro atrás, dominante en el físico; poca creación.' },
  reflejos: { label: 'Portero de reflejos', desc: 'Paradas imposibles; juego con los pies mejorable.' },
  completo: { label: 'Jugador completo', desc: 'Equilibrado en todo, sin picos de nivel.' },
};

export const DIFFICULTY_LABELS: Record<Difficulty, { label: string; desc: string; mult: number }> = {
  facil: { label: 'Fácil', desc: 'Crecimiento rápido y rivales asequibles.', mult: 0.85 },
  normal: { label: 'Normal', desc: 'La experiencia equilibrada recomendada.', mult: 1 },
  dificil: { label: 'Difícil', desc: 'Menos minutos, rivales duros, progresión lenta.', mult: 1.25 },
  unaVida: { label: 'Una sola vida', desc: 'Difícil y sin margen: una lesión grave acaba la carrera.', mult: 1.5 },
};

export const TRAINING_LABELS: Record<TrainingFocus, { label: string; cost: string }> = {
  finalizacion: { label: 'Finalización', cost: 'Fatiga moderada' },
  pase: { label: 'Pase', cost: 'Fatiga ligera' },
  regate: { label: 'Regate', cost: 'Fatiga moderada' },
  velocidad: { label: 'Velocidad', cost: 'Fatiga alta, riesgo muscular' },
  resistencia: { label: 'Resistencia', cost: 'Fatiga alta' },
  defensa: { label: 'Defensa', cost: 'Fatiga moderada' },
  fisico: { label: 'Físico', cost: 'Fatiga alta, riesgo de lesión' },
  balonParado: { label: 'Balón parado', cost: 'Fatiga ligera' },
  recuperacion: { label: 'Recuperación', cost: 'Sin mejora: recupera cuerpo y moral' },
};

export const FIELD_ATTR_LABELS: Record<FieldAttr, string> = {
  ritmo: 'Ritmo',
  tecnica: 'Técnica',
  pase: 'Pase',
  disparo: 'Disparo',
  regate: 'Regate',
  defensa: 'Defensa',
  fisico: 'Físico',
  vision: 'Visión',
  concentracion: 'Concentración',
  resistencia: 'Resistencia',
};

export const GK_ATTR_LABELS: Record<GkAttr, string> = {
  reflejos: 'Reflejos',
  colocacion: 'Colocación',
  blocaje: 'Blocaje',
  aereo: 'Juego aéreo',
  salida: 'Salida',
  pies: 'Juego con los pies',
};

export const RISK_LABELS: Record<MatchOption['risk'], string> = {
  muyProbable: 'Muy probable',
  probable: 'Probable',
  arriesgado: 'Arriesgado',
  muyArriesgado: 'Muy arriesgado',
};

export function emptySeasonStats(): SeasonStats {
  return {
    pj: 0,
    titularidades: 0,
    minutos: 0,
    goles: 0,
    asistencias: 0,
    tiros: 0,
    pases: 0,
    recuperaciones: 0,
    paradas: 0,
    porteriasCero: 0,
    amarillas: 0,
    rojas: 0,
    ratingSum: 0,
    ratingCount: 0,
  };
}
