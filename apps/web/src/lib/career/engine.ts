/**
 * Motor de simulación del Modo Carrera.
 * Determinista: toda la aleatoriedad sale de un RNG con semilla guardada en la
 * partida, de modo que una misma semilla produce la misma carrera ante las
 * mismas decisiones. Cada función pública devuelve un estado nuevo (inmutable
 * hacia fuera) y no realiza peticiones remotas.
 */
import {
  ARCHETYPE_BASES,
  ELITE_CLUBS,
  FIRST_NAMES,
  GK_BASES,
  INJURIES,
  LAST_NAMES,
  LEAGUES,
  OVR_WEIGHTS,
  RIVAL_ADJECTIVES,
  leagueFor,
  makeClub,
} from './data';
import { confederationOf, continentalTournamentName, countryName, countryNatLevel } from './countries';
import { chance, clamp, createRng, pick, randInt, randomSeed, seedFromText, type Rng } from './rng';
import {
  emptySeasonStats,
  type Attributes,
  type CareerCard,
  type CareerConfig,
  type CareerState,
  type Club,
  type ContractRole,
  type Difficulty,
  type InjuryState,
  type LegendLevel,
  type MatchMoment,
  type MatchOption,
  type MatchResult,
  type NarrativeEvent,
  type PlayerState,
  type Position,
  type SeasonObjective,
  type SeasonSummary,
  type TrainingFocus,
  type TransferOffer,
} from './types';

const START_YEAR = 2026;
const MAX_AGE = 40;
const JORNADAS = 30;

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------

function cloneState(state: CareerState): CareerState {
  return JSON.parse(JSON.stringify(state)) as CareerState;
}

function rngOf(state: CareerState): Rng {
  return createRng(state.rngState);
}

function saveRng(state: CareerState, rng: Rng): void {
  state.rngState = rng.state();
}

function log(state: CareerState, text: string, kind: CareerState['log'][number]['kind']): void {
  state.log.unshift({ year: state.year, jornada: state.jornada, text, kind });
  if (state.log.length > 60) state.log.length = 60;
}

function addAchievement(state: CareerState, name: string): boolean {
  if (state.achievements.includes(name)) return false;
  state.achievements.push(name);
  log(state, `Logro: ${name}`, 'logro');
  return true;
}

export function overall(player: PlayerState): number {
  const weights = OVR_WEIGHTS[player.position];
  let total = 0;
  let sum = 0;
  for (const [key, w] of Object.entries(weights)) {
    total += (player.attributes[key as keyof Attributes] ?? 0) * (w ?? 0);
    sum += w ?? 0;
  }
  return Math.round(sum > 0 ? total / sum : 0);
}

function difficultyMult(d: Difficulty): number {
  switch (d) {
    case 'facil':
      return 0.85;
    case 'normal':
      return 1;
    case 'dificil':
      return 1.2;
    case 'unaVida':
      return 1.35;
  }
}

function marketValue(player: PlayerState): number {
  const ovr = overall(player);
  const ageFactor = player.age <= 23 ? 1.3 : player.age <= 27 ? 1.15 : player.age <= 30 ? 0.9 : player.age <= 33 ? 0.5 : 0.2;
  const base = Math.max(0, ovr - 50);
  const value = (base * base * ageFactor * (0.6 + player.reputacion / 120)) / 22;
  return Math.round(value * 10) / 10;
}

function refreshValue(state: CareerState): void {
  state.player.valueM = marketValue(state.player);
  if (state.player.valueM > state.player.maxValueM) state.player.maxValueM = state.player.valueM;
}

// ---------------------------------------------------------------------------
// Creación de carrera
// ---------------------------------------------------------------------------

export function suggestName(rng?: Rng): string {
  const r = rng ?? createRng(randomSeed());
  return `${pick(r, FIRST_NAMES)} ${pick(r, LAST_NAMES)}`;
}

function buildAttributes(config: CareerConfig, rng: Rng): { attributes: Attributes; potential: number } {
  const base = ARCHETYPE_BASES[config.archetype];
  const gk = config.position === 'POR' ? (config.archetype === 'reflejos' ? GK_BASES.reflejos : GK_BASES.otros) : {};
  const attributes = {} as Attributes;
  const keys: Array<keyof Attributes> = [
    'ritmo',
    'tecnica',
    'pase',
    'disparo',
    'regate',
    'defensa',
    'fisico',
    'vision',
    'concentracion',
    'resistencia',
    'reflejos',
    'colocacion',
    'blocaje',
    'aereo',
    'salida',
    'pies',
  ];
  for (const key of keys) {
    const fromArchetype = (base as Partial<Attributes>)[key] ?? (gk as Partial<Attributes>)[key] ?? (config.position === 'POR' ? 30 : 20);
    attributes[key] = clamp(fromArchetype + randInt(rng, -4, 4), 15, 70);
  }
  // La altura influye levemente: aéreo/físico frente a ritmo/regate.
  const tall = config.heightCm >= 188;
  const short = config.heightCm <= 172;
  if (tall) {
    attributes.aereo = clamp(attributes.aereo + 6, 15, 75);
    attributes.fisico = clamp(attributes.fisico + 3, 15, 75);
    attributes.ritmo = clamp(attributes.ritmo - 2, 15, 75);
  } else if (short) {
    attributes.regate = clamp(attributes.regate + 4, 15, 75);
    attributes.ritmo = clamp(attributes.ritmo + 2, 15, 75);
    attributes.aereo = clamp(attributes.aereo - 5, 15, 75);
  }
  // Potencial oculto: no todos los jugadores pueden llegar al máximo.
  const roll = rng.next();
  const potential = roll > 0.93 ? randInt(rng, 92, 99) : roll > 0.7 ? randInt(rng, 85, 92) : randInt(rng, 76, 86);
  return { attributes, potential };
}

function startingClub(config: CareerConfig, rng: Rng): { club: Club; division: number } {
  const league = leagueFor(config.startCountry);
  const name = pick(rng, league.clubs2);
  return {
    club: makeClub(name, league.name2, config.startCountry, 1, randInt(rng, 42, 52)),
    division: 2,
  };
}

function seasonObjectives(state: CareerState, rng: Rng): SeasonObjective[] {
  const pos = state.player.position;
  const role = state.contract.role;
  const minMinutes = role === 'canterano' || role === 'suplente' ? 600 : role === 'rotacion' ? 1200 : 1900;
  const objectives: SeasonObjective[] = [
    { kind: 'minutos', level: 'minimo', label: `Disputar ${minMinutes} minutos`, target: minMinutes, done: false },
  ];
  if (pos === 'POR') {
    const target = role === 'titular' || role === 'estrella' ? 8 : 4;
    objectives.push({ kind: 'porteriasCero', level: 'principal', label: `${target} porterías a cero`, target, done: false });
  } else if (pos === 'DFC' || pos === 'LAT') {
    objectives.push({ kind: 'valoracion', level: 'principal', label: 'Valoración media de 6,8', target: 6.8, done: false });
  } else if (pos === 'MC' || pos === 'MCO') {
    const target = randInt(rng, 4, 7);
    objectives.push({ kind: 'asistencias', level: 'principal', label: `Dar ${target} asistencias`, target, done: false });
  } else {
    const base = role === 'titular' || role === 'estrella' ? randInt(rng, 10, 15) : randInt(rng, 5, 8);
    objectives.push({ kind: 'goles', level: 'principal', label: `Marcar ${base} goles`, target: base, done: false });
  }
  if (state.club.tier >= 4) {
    objectives.push({ kind: 'titulo', level: 'extraordinario', label: 'Ganar la liga', target: 1, done: false });
  } else if (state.club.tier >= 2 && state.division === 1) {
    objectives.push({ kind: 'clasificacionEuropea', level: 'extraordinario', label: 'Clasificar para Europa (top 5)', target: 5, done: false });
  } else if (state.division === 2) {
    objectives.push({ kind: 'clasificacionEuropea', level: 'extraordinario', label: 'Ascender de división (top 3)', target: 3, done: false });
  } else {
    objectives.push({ kind: 'evitarDescenso', level: 'extraordinario', label: 'Terminar fuera del descenso', target: 17, done: false });
  }
  return objectives;
}

export function createCareer(config: CareerConfig): CareerState {
  const seed = config.seedText != null && config.seedText.trim() !== '' ? seedFromText(config.seedText.trim()) : randomSeed();
  const rng = createRng(seed);
  const { attributes, potential } = buildAttributes(config, rng);
  const { club, division } = startingClub(config, rng);

  const player: PlayerState = {
    name: config.name.trim() || suggestName(rng),
    primaryNationalityCode: config.primaryNationalityCode,
    secondaryNationalityCode: config.secondaryNationalityCode,
    age: config.age,
    position: config.position,
    foot: config.foot,
    heightCm: config.heightCm,
    archetype: config.archetype,
    attributes,
    potential,
    forma: 50,
    moral: 60,
    fitness: 95,
    reputacion: 5,
    coachTrust: 35,
    valueM: 0,
    maxValueM: 0,
  };

  const state: CareerState = {
    v: 2,
    id: `carrera-${Date.now().toString(36)}-${seed.toString(36)}`,
    createdAt: new Date().toISOString(),
    seed,
    rngState: rng.state(),
    difficulty: config.difficulty,
    year: START_YEAR,
    seasonIndex: 0,
    jornada: 1,
    totalJornadas: JORNADAS,
    leaguePos: randInt(rng, 8, 14),
    player,
    club,
    division,
    contract: { clubId: club.id, yearsLeft: 3, salaryK: 1, role: 'canterano' },
    training: 'recuperacion',
    stats: emptySeasonStats(),
    careerTotals: emptySeasonStats(),
    history: [],
    objectives: [],
    trophies: [],
    achievements: [],
    national: { level: 'ninguna', teamCode: null, caps: 0, goals: 0, tournamentsWon: [] },
    injury: null,
    log: [],
    screen: { type: 'jornada' },
    retired: false,
    retirementReason: null,
  };
  state.objectives = seasonObjectives(state, rng);
  refreshValue(state);
  saveRng(state, rng);
  log(state, `Debut en la academia del ${club.name} (${club.league}).`, 'contrato');
  return state;
}

// ---------------------------------------------------------------------------
// Simulación de partido
// ---------------------------------------------------------------------------

export type MatchApproach = 'seguro' | 'riesgo' | 'energia';

interface SimContext {
  rng: Rng;
  approach: MatchApproach;
  interactive: boolean;
}

function positionGroup(pos: Position): 'gk' | 'def' | 'mid' | 'att' {
  if (pos === 'POR') return 'gk';
  if (pos === 'DFC' || pos === 'LAT') return 'def';
  if (pos === 'MC' || pos === 'MCO') return 'mid';
  return 'att';
}

function effectiveLevel(state: CareerState): number {
  const p = state.player;
  const ovr = overall(p);
  const formFactor = (p.forma - 50) * 0.12;
  const fitnessFactor = (p.fitness - 70) * 0.08;
  const moraleFactor = (p.moral - 50) * 0.05;
  return ovr + formFactor + fitnessFactor + moraleFactor;
}

function startProbability(state: CareerState): number {
  const trust = state.player.coachTrust / 100;
  const roleBase: Record<ContractRole, number> = { canterano: 0.22, suplente: 0.3, rotacion: 0.55, titular: 0.85, estrella: 0.94 };
  const fitnessPenalty = state.player.fitness < 55 ? 0.25 : 0;
  return clamp(roleBase[state.contract.role] * (0.55 + trust * 0.8) - fitnessPenalty, 0.05, 0.97);
}

function simulateTeamGoals(rng: Rng, attack: number, defense: number): number {
  const expected = clamp(1.35 + (attack - defense) / 30, 0.3, 3.2);
  let goals = 0;
  let p = Math.exp(-expected);
  let acc = p;
  const roll = rng.next();
  while (acc < roll && goals < 6) {
    goals += 1;
    p = (p * expected) / goals;
    acc += p;
  }
  return goals;
}

function makeMoment(state: CareerState, rng: Rng): MatchMoment | null {
  const p = state.player;
  const group = positionGroup(p.position);
  const minute = randInt(rng, 55, 88);
  const skill = (k: keyof Attributes) => p.attributes[k] / 100;

  const opt = (
    id: string,
    label: string,
    successP: number,
    success: MatchOption['success'],
    failure: MatchOption['failure'],
  ): MatchOption => {
    const sp = clamp(successP, 0.08, 0.93);
    const risk: MatchOption['risk'] = sp >= 0.75 ? 'muyProbable' : sp >= 0.55 ? 'probable' : sp >= 0.35 ? 'arriesgado' : 'muyArriesgado';
    return { id, label, risk, successP: sp, success, failure };
  };

  if (group === 'gk') {
    if (!chance(rng, 0.4)) return null;
    return {
      id: 'penalti-contra',
      minute,
      text: `Minuto ${minute}: penalti en contra. El delantero rival coloca el balón en los once metros.`,
      options: [
        opt('esperar', 'Aguantar hasta el final', 0.2 + skill('reflejos') * 0.35, { text: '¡Parada salvadora! El estadio se viene abajo.', paradas: 1, rating: 1.6, moral: 10, reputacion: 2 }, { text: 'Gol rival. Nadie te lo reprocha.', rating: -0.3, moral: -3 }),
        opt('lado-fuerte', 'Lanzarte a tu lado fuerte', 0.15 + skill('colocacion') * 0.3, { text: 'Adivinaste el lado y la sacaste con una mano.', paradas: 1, rating: 1.5, moral: 9, reputacion: 2 }, { text: 'Te tiraste antes de tiempo y fue gol.', rating: -0.5, moral: -4 }),
        opt('provocar', 'Provocar al lanzador', 0.12 + skill('concentracion') * 0.28, { text: 'Le sacaste de quicio: mandó el balón a las nubes.', rating: 1.2, moral: 8 }, { text: 'El colegiado te amonesta y el rival marca.', rating: -0.6, moral: -5, tarjetaP: 0.9 }),
      ],
    };
  }

  const situations: MatchMoment[] = [];
  if (group === 'att' || group === 'mid') {
    situations.push({
      id: 'ocasion-area',
      minute,
      text: `Minuto ${minute}: recibes en el área con un defensa encima y un compañero solo en el segundo palo.`,
      options: [
        opt('disparo', 'Buscar el disparo', 0.18 + skill('disparo') * 0.5, { text: '¡Golazo! Definiste con frialdad.', goles: 1, tiros: 1, rating: 1.5, moral: 10, reputacion: 2 }, { text: 'El portero adivinó tu intención.', tiros: 1, rating: -0.2, moral: -2 }),
        opt('pase', 'Dar el pase al segundo palo', 0.3 + skill('vision') * 0.45, { text: 'Asistencia de oro: tu compañero solo tuvo que empujarla.', asistencias: 1, rating: 1.1, moral: 7, reputacion: 1 }, { text: 'El pase salió desviado y se perdió la ocasión.', rating: -0.3, moral: -3 }),
        opt('regate', 'Intentar el regate', 0.1 + skill('regate') * 0.5, { text: 'Te fuiste del defensa y marcaste a placer.', goles: 1, tiros: 1, rating: 1.8, moral: 12, reputacion: 3 }, { text: 'El defensa te robó la cartera.', rating: -0.5, moral: -4, lesionP: 0.06 }),
      ],
    });
    situations.push({
      id: 'falta-peligrosa',
      minute,
      text: `Minuto ${minute}: falta al borde del área. El capitán te mira: puedes lanzarla tú.`,
      options: [
        opt('lanzar', 'Tirar la falta', 0.1 + skill('disparo') * 0.35 + skill('tecnica') * 0.15, { text: 'La colgaste en la escuadra. ¡Qué golazo!', goles: 1, tiros: 1, rating: 1.7, moral: 12, reputacion: 3 }, { text: 'Se estrelló en la barrera.', tiros: 1, rating: -0.2, moral: -2 }),
        opt('ceder', 'Cederla al especialista', 0.85, { text: 'Decisión madura: el especialista rozó el gol.', rating: 0.2, moral: 1 }, { text: 'El lanzamiento se perdió sin peligro.', rating: 0, moral: 0 }),
      ],
    });
  }
  if (group === 'def' || group === 'mid') {
    situations.push({
      id: 'contra-rival',
      minute,
      text: `Minuto ${minute}: contragolpe rival. El extremo encara hacia tu zona a toda velocidad.`,
      options: [
        opt('entrada', 'Ir fuerte a la entrada', 0.25 + skill('defensa') * 0.45, { text: 'Cortaste el contragolpe con una entrada perfecta.', recuperaciones: 1, rating: 1.2, moral: 7 }, { text: 'Llegaste tarde: tarjeta y peligro.', rating: -0.7, moral: -5, tarjetaP: 0.8 }),
        opt('contener', 'Contener y ganar tiempo', 0.55 + skill('concentracion') * 0.3, { text: 'Le frenaste hasta que llegó la ayuda.', rating: 0.6, moral: 3 }, { text: 'Te hizo un caño y generó una ocasión clara.', rating: -0.5, moral: -4 }),
        opt('anticipar', 'Anticipar el pase', 0.2 + skill('vision') * 0.4, { text: 'Leíste el pase y saliste jugando con clase.', recuperaciones: 1, rating: 1.0, moral: 6, reputacion: 1 }, { text: 'La anticipación falló y quedaron 2 contra 1.', rating: -0.6, moral: -4 }),
      ],
    });
  }
  situations.push({
    id: 'penalti-favor',
    minute,
    text: `Minuto ${minute}: penalti a favor. Tus compañeros dudan y el estadio corea tu nombre.`,
    options: [
      opt('tirar', 'Asumir el penalti', 0.5 + skill('disparo') * 0.3 + skill('concentracion') * 0.1, { text: 'Lo lanzaste con personalidad: ¡gol!', goles: 1, tiros: 1, rating: 1.3, moral: 9, reputacion: 2 }, { text: 'El portero lo detuvo. Golpe duro.', tiros: 1, rating: -0.8, moral: -8 }),
      opt('dejar', 'Dejar que tire el capitán', 0.75, { text: 'El capitán no falló y te agradeció el gesto.', rating: 0.3, moral: 2 }, { text: 'El capitán falló. Quizá debiste asumirlo tú.', rating: 0, moral: -3 }),
    ],
  });

  if (!chance(rng, 0.55)) return null;
  const moment = pick(rng, situations);
  return { ...moment, minute };
}

function ratingFor(state: CareerState, r: MatchResult): number {
  const pos = state.player.position;
  const group = positionGroup(pos);
  let rating = 6.0;
  const winBonus = r.golesFavor > r.golesContra ? 0.35 : r.golesFavor === r.golesContra ? 0.05 : -0.3;
  rating += winBonus;
  if (group === 'gk') {
    rating += r.paradas * 0.22 - r.golesContra * 0.35 + (r.porteriaCero ? 0.9 : 0);
  } else if (group === 'def') {
    rating += r.recuperaciones * 0.12 + (r.porteriaCero ? 0.55 : 0) - r.golesContra * 0.12 + r.goles * 0.9 + r.asistencias * 0.5;
  } else if (group === 'mid') {
    rating += r.goles * 0.85 + r.asistencias * 0.65 + r.pases / 90 + r.recuperaciones * 0.07;
  } else {
    rating += r.goles * 0.95 + r.asistencias * 0.55 + r.tiros * 0.06 - (r.tiros > 3 && r.goles === 0 ? 0.25 : 0);
  }
  if (r.amarilla) rating -= 0.25;
  if (r.roja) rating -= 1.6;
  if (r.minutos < 30) rating = 6.0 + (rating - 6.0) * 0.5;
  return clamp(Math.round(rating * 10) / 10, 3, 10);
}

function baseMatch(state: CareerState, ctx: SimContext): MatchResult {
  const { rng } = ctx;
  const p = state.player;
  const level = effectiveLevel(state) * (ctx.approach === 'energia' ? 0.94 : 1);
  const rivalStrength = clamp(state.club.strength + randInt(rng, -10, 10), 30, 98);
  const home = state.jornada % 2 === 0;
  const teamAttack = state.club.strength + (home ? 3 : -2) + (level - 60) * 0.15;
  const golesFavor = simulateTeamGoals(rng, teamAttack, rivalStrength);
  const golesContra = simulateTeamGoals(rng, rivalStrength, state.club.strength + (home ? 2 : -2));

  const titular = chance(rng, startProbability(state));
  const convocado = titular || chance(rng, 0.8);
  const minutos = !convocado ? 0 : titular ? (chance(rng, 0.2) ? randInt(rng, 55, 80) : 90) : chance(rng, 0.6) ? randInt(rng, 5, 35) : 0;

  const group = positionGroup(p.position);
  const skill = (k: keyof Attributes) => p.attributes[k];
  const minFactor = minutos / 90;
  const riskMult = ctx.approach === 'riesgo' ? 1.3 : ctx.approach === 'seguro' ? 0.8 : 1;

  let goles = 0;
  let asistencias = 0;
  let tiros = 0;
  let paradas = 0;
  const pases = Math.round((30 + skill('pase') * 0.6) * minFactor * (group === 'mid' ? 1.3 : group === 'def' ? 1.1 : 0.8));
  const recuperaciones = Math.round((group === 'def' ? 6 : group === 'mid' ? 4.5 : 1.5) * (skill('defensa') / 60) * minFactor);

  if (minutos > 0) {
    if (group === 'gk') {
      paradas = Math.max(0, Math.round((2 + rivalStrength / 25) * (skill('reflejos') / 60) * minFactor) + randInt(rng, -1, 2));
    } else {
      const shotBase = group === 'att' ? 3 : group === 'mid' ? 1.6 : 0.4;
      tiros = Math.max(0, Math.round(shotBase * minFactor * riskMult) + randInt(rng, -1, 1));
      const finishing = (skill('disparo') / 100) * 0.32 * (ctx.approach === 'riesgo' ? 1.15 : 1);
      for (let i = 0; i < tiros; i++) if (chance(rng, clamp(finishing - rivalStrength / 600, 0.03, 0.5))) goles += 1;
      goles = Math.min(goles, golesFavor);
      const assistP = clamp(((skill('pase') + skill('vision')) / 260) * minFactor * (group === 'mid' ? 1.25 : 1), 0.02, 0.5);
      if (golesFavor - goles > 0 && chance(rng, assistP)) asistencias = 1;
      if (golesFavor - goles > 1 && chance(rng, assistP * 0.4)) asistencias += 1;
    }
  }

  const aggression = group === 'def' ? 0.18 : 0.1;
  const amarilla = minutos > 0 && chance(rng, aggression * riskMult * (1.2 - skill('concentracion') / 120));
  const roja = amarilla && chance(rng, 0.07);

  const result: MatchResult = {
    jornada: state.jornada,
    rival: rivalName(state, rng),
    rivalStrength,
    home,
    golesFavor,
    golesContra,
    titular: titular && minutos > 0,
    minutos,
    goles,
    asistencias,
    tiros,
    pases,
    recuperaciones,
    paradas,
    porteriaCero: golesContra === 0 && minutos >= 45,
    amarilla,
    roja,
    rating: 0,
    headline: '',
  };
  result.rating = minutos > 0 ? ratingFor(state, result) : 0;
  return result;
}

function rivalName(state: CareerState, rng: Rng): string {
  const league = LEAGUES.find((l) => l.country === state.club.country) ?? LEAGUES[0]!;
  const poolRaw = state.division === 1 ? league.clubs1 : league.clubs2;
  const pool = poolRaw.filter((c) => c !== state.club.name);
  const name = pool.length > 0 ? pick(rng, pool) : 'Rival Regional';
  return `${name} (${pick(rng, RIVAL_ADJECTIVES)})`;
}

function headline(state: CareerState, r: MatchResult): string {
  if (r.minutos === 0) return 'Sin minutos esta jornada. El técnico apostó por otros.';
  if (r.roja) return 'La expulsión condicionó tu partido.';
  if (r.goles >= 2) return `¡Doblete! Actuación estelar contra ${r.rival}.`;
  if (r.goles === 1) return 'Tu gol pesó en el marcador.';
  if (r.paradas >= 5) return 'Una actuación de mérito bajo palos.';
  if (r.rating >= 7.5) return 'Elegido entre los mejores del partido.';
  if (r.rating <= 5) return 'Un día para olvidar.';
  return r.golesFavor > r.golesContra ? 'Victoria de tu equipo.' : r.golesFavor === r.golesContra ? 'Reparto de puntos.' : 'Derrota que duele.';
}

function applyMatchToState(state: CareerState, r: MatchResult, rng: Rng, notes: string[]): void {
  const p = state.player;
  const s = state.stats;
  if (r.minutos > 0) {
    s.pj += 1;
    if (r.titular) s.titularidades += 1;
    s.minutos += r.minutos;
    s.goles += r.goles;
    s.asistencias += r.asistencias;
    s.tiros += r.tiros;
    s.pases += r.pases;
    s.recuperaciones += r.recuperaciones;
    s.paradas += r.paradas;
    if (r.porteriaCero) s.porteriasCero += 1;
    if (r.amarilla) s.amarillas += 1;
    if (r.roja) s.rojas += 1;
    s.ratingSum += r.rating;
    s.ratingCount += 1;

    if (s.pj === 1 && state.careerTotals.pj === 0) addAchievement(state, 'Debut profesional');
    if (r.goles > 0) addAchievement(state, 'Primer gol como profesional');

    p.forma = clamp(p.forma + (r.rating - 6.2) * 6, 0, 100);
    p.moral = clamp(p.moral + (r.rating - 6.2) * 3 + (r.golesFavor > r.golesContra ? 2 : -2), 0, 100);
    p.coachTrust = clamp(p.coachTrust + (r.rating - 6.3) * 3.5, 0, 100);
    p.reputacion = clamp(p.reputacion + Math.max(0, r.rating - 6.8) * 0.9 * state.club.tier, 0, 100);
    p.fitness = clamp(p.fitness - r.minutos / 9, 0, 100);
  } else {
    p.moral = clamp(p.moral - 4, 0, 100);
    p.forma = clamp(p.forma - 2, 0, 100);
    p.fitness = clamp(p.fitness + 8, 0, 100);
    notes.push('La suplencia te dolió: la moral baja un poco.');
  }

  // Evolución de la clasificación del equipo (paseo influido por el resultado).
  const drift = r.golesFavor > r.golesContra ? -1 : r.golesFavor < r.golesContra ? 1 : 0;
  state.leaguePos = clamp(state.leaguePos + drift + randInt(rng, -1, 1), 1, 20);

  // Lesión post-partido por fatiga.
  const injuryRisk = (r.minutos / 90) * 0.035 * (p.fitness < 45 ? 2.2 : p.fitness < 65 ? 1.4 : 1) * difficultyMult(state.difficulty);
  if (r.minutos > 0 && state.injury == null && chance(rng, injuryRisk)) {
    const injury = rollInjury(state, rng, false);
    notes.push(`Lesión: ${injury.name} (${injury.weeksOut} ${injury.weeksOut === 1 ? 'jornada' : 'jornadas'} de baja).`);
  }
}

function rollInjury(state: CareerState, rng: Rng, forced: boolean): InjuryState {
  const roll = rng.next();
  const def = roll > 0.96 ? INJURIES[5]! : roll > 0.88 ? INJURIES[4]! : pick(rng, INJURIES.slice(0, 4));
  const injury: InjuryState = {
    name: def.name,
    weeksOut: randInt(rng, def.min, def.max) + (forced ? 1 : 0),
    relapseRisk: def.grave ? 0.35 : 0.18,
    playingThrough: false,
  };
  state.injury = injury;
  log(state, `Lesión: ${injury.name} (${injury.weeksOut} jornadas).`, 'lesion');
  if (def.grave && state.difficulty === 'unaVida') {
    state.retired = true;
    state.retirementReason = `Una ${def.name.toLowerCase()} puso fin a tu carrera en el modo de una sola vida.`;
  }
  return injury;
}

// ---------------------------------------------------------------------------
// Entrenamiento y progresión
// ---------------------------------------------------------------------------

const TRAINING_TARGETS: Record<TrainingFocus, Array<keyof Attributes>> = {
  finalizacion: ['disparo', 'concentracion'],
  pase: ['pase', 'vision'],
  regate: ['regate', 'tecnica'],
  velocidad: ['ritmo'],
  resistencia: ['resistencia'],
  defensa: ['defensa', 'concentracion'],
  fisico: ['fisico'],
  balonParado: ['disparo', 'tecnica'],
  recuperacion: [],
};

const GK_TRAINING_TARGETS: Partial<Record<TrainingFocus, Array<keyof Attributes>>> = {
  finalizacion: ['reflejos', 'blocaje'],
  pase: ['pies', 'salida'],
  regate: ['colocacion'],
  defensa: ['aereo', 'colocacion'],
  balonParado: ['colocacion', 'blocaje'],
};

function trainingCost(focus: TrainingFocus): { fatigue: number; injuryP: number; moral: number } {
  switch (focus) {
    case 'recuperacion':
      return { fatigue: -10, injuryP: 0, moral: 1 };
    case 'velocidad':
    case 'fisico':
    case 'resistencia':
      return { fatigue: 5, injuryP: 0.02, moral: -1 };
    case 'pase':
    case 'balonParado':
      return { fatigue: 2, injuryP: 0.004, moral: 0 };
    default:
      return { fatigue: 3, injuryP: 0.01, moral: 0 };
  }
}

function ageGrowthFactor(age: number): number {
  if (age <= 19) return 1.4;
  if (age <= 23) return 1.1;
  if (age <= 27) return 0.7;
  if (age <= 30) return 0.3;
  return 0.08;
}

function applyWeeklyTraining(state: CareerState, rng: Rng, minutes: number, notes: string[]): void {
  const p = state.player;
  const focus = state.training;
  const cost = trainingCost(focus);
  p.fitness = clamp(p.fitness - cost.fatigue, 0, 100);
  p.moral = clamp(p.moral + cost.moral, 0, 100);

  if (state.injury == null && chance(rng, cost.injuryP)) {
    rollInjury(state, rng, false);
    notes.push('Te lesionaste forzando en el entrenamiento.');
    return;
  }
  if (focus === 'recuperacion') return;

  const targets = p.position === 'POR' ? (GK_TRAINING_TARGETS[focus] ?? TRAINING_TARGETS[focus]) : TRAINING_TARGETS[focus];
  const ovr = overall(p);
  const headroom = clamp((p.potential - ovr) / 25, 0.05, 1.2);
  const minutesFactor = 0.55 + Math.min(minutes, 90) / 140;
  const gainBase = 0.5 * ageGrowthFactor(p.age) * headroom * minutesFactor / difficultyMult(state.difficulty);
  for (const key of targets) {
    if (chance(rng, clamp(gainBase, 0.03, 0.75))) {
      p.attributes[key] = clamp(p.attributes[key] + 1, 1, Math.min(99, p.potential + 2));
    }
  }
  // Declive natural con la edad.
  if (p.age >= 31 && chance(rng, 0.18 + (p.age - 31) * 0.05)) {
    const decayKey = pick(rng, ['ritmo', 'fisico', 'resistencia'] as const);
    p.attributes[decayKey] = clamp(p.attributes[decayKey] - 1, 1, 99);
  }
}

// ---------------------------------------------------------------------------
// Eventos narrativos
// ---------------------------------------------------------------------------

function narrativePool(state: CareerState, rng: Rng): NarrativeEvent[] {
  const p = state.player;
  const events: NarrativeEvent[] = [];

  events.push({
    id: 'prensa',
    title: 'La prensa te busca',
    text: 'Un periodista te pregunta en zona mixta por el nivel del equipo y tu papel en él.',
    options: [
      { id: 'humilde', label: 'Responder con humildad', hint: 'Seguro', effects: { coachTrust: 4, reputacion: 1, text: 'Tus palabras gustaron dentro del vestuario.' } },
      { id: 'ambicioso', label: 'Reivindicarte con ambición', hint: 'Arriesgado', effects: { reputacion: 4, coachTrust: -4, moral: 3, text: 'Titulares por todas partes: presión extra, pero tu nombre suena.' } },
      { id: 'callar', label: 'Evitar la pregunta', hint: 'Neutro', effects: { text: 'Sin titulares. A veces el silencio es la mejor respuesta.' } },
    ],
  });
  events.push({
    id: 'extra',
    title: 'Sesión extra',
    text: 'El cuerpo técnico ofrece sesiones voluntarias por la tarde esta semana.',
    options: [
      { id: 'ir', label: 'Entrenar más', hint: 'Mejora, pero fatiga', effects: { devBoost: 2, fitness: -8, coachTrust: 5, injuryP: 0.05, text: 'El técnico tomó nota de tu compromiso.' } },
      { id: 'descansar', label: 'Descansar', hint: 'Recupera el cuerpo', effects: { fitness: 10, moral: 2, coachTrust: -2, text: 'Llegas fresco al partido, aunque el técnico esperaba verte.' } },
    ],
  });
  if (p.coachTrust < 45) {
    events.push({
      id: 'conflicto',
      title: 'Conflicto con el entrenador',
      text: 'Llevas semanas con menos minutos de los que crees merecer. El técnico te cita en su despacho.',
      options: [
        { id: 'dialogo', label: 'Hablarlo con calma', hint: 'Probable mejora', effects: { coachTrust: 8, moral: 3, text: 'La conversación limpió el ambiente.' } },
        { id: 'plantarse', label: 'Plantarte y exigir', hint: 'Muy arriesgado', effects: { coachTrust: -8, reputacion: 3, moral: 4, text: 'El pulso es público: o juegas o el vestuario arde.' } },
        { id: 'trabajar', label: 'Responder entrenando', hint: 'Lento pero seguro', effects: { coachTrust: 4, devBoost: 1, text: 'Sin ruido: que hablen tus entrenamientos.' } },
      ],
    });
  }
  if (state.contract.yearsLeft <= 1 && state.jornada > 8) {
    events.push({
      id: 'renovacion',
      title: 'Oferta de renovación',
      text: `El ${state.club.name} pone sobre la mesa una renovación con una ligera mejora salarial.`,
      options: [
        { id: 'renovar', label: 'Renovar 3 años', hint: 'Estabilidad', effects: { salaryK: Math.max(1, Math.round(state.contract.salaryK * 0.3)), moral: 4, coachTrust: 5, text: 'Renovaste. El club te ve como parte del proyecto.' } },
        { id: 'mejora', label: 'Pedir una mejora mayor', hint: 'Arriesgado', effects: { salaryK: chance(rng, 0.5 + p.reputacion / 250) ? Math.max(2, Math.round(state.contract.salaryK * 0.6)) : 0, coachTrust: -3, text: 'Negociación tensa con tu agente al frente.' } },
        { id: 'esperar', label: 'Esperar ofertas', hint: 'Libertad en verano', effects: { coachTrust: -5, reputacion: 1, text: 'El club encaja mal tu espera. El mercado dirá.' } },
      ],
    });
  }
  // Doble nacionalidad: elegir federación antes de la primera convocatoria.
  if (
    p.secondaryNationalityCode != null &&
    state.national.teamCode == null &&
    p.reputacion >= 12
  ) {
    const primaryName = countryName(p.primaryNationalityCode);
    const secondaryName = countryName(p.secondaryNationalityCode);
    events.push({
      id: 'federaciones',
      title: 'Dos federaciones te tantean',
      text: `Las federaciones de ${primaryName} y ${secondaryName} siguen tus pasos. Tu agente te pide una señal antes de que llegue la primera convocatoria oficial.`,
      options: [
        {
          id: 'principal',
          label: `Comprometerme con ${primaryName}`,
          hint: 'Fija tu selección',
          effects: { chooseNationalTeam: 'principal', moral: 4, text: `Decisión tomada: vestirás la camiseta de ${primaryName}.` },
        },
        {
          id: 'secundaria',
          label: `Comprometerme con ${secondaryName}`,
          hint: 'Fija tu selección',
          effects: { chooseNationalTeam: 'secundaria', moral: 4, text: `Decisión tomada: vestirás la camiseta de ${secondaryName}.` },
        },
        {
          id: 'esperar',
          label: 'Esperar una convocatoria',
          hint: 'Decidirá el rendimiento',
          effects: { reputacion: 1, text: 'Sin compromisos: la primera convocatoria en llegar decidirá tu futuro internacional.' },
        },
      ],
    });
  }
  if (state.injury != null && state.injury.weeksOut <= 2) {
    events.push({
      id: 'infiltrarse',
      title: 'Jugar infiltrado',
      text: 'El médico dice que podrías jugar con una infiltración, pero recomienda esperar.',
      options: [
        { id: 'jugar', label: 'Jugar infiltrado', hint: 'Muy arriesgado', effects: { injuryP: 0.4, coachTrust: 6, moral: 2, text: 'Apretaste los dientes. El cuerpo pasará factura… o no.' } },
        { id: 'esperar', label: 'Recuperarte del todo', hint: 'Seguro', effects: { fitness: 6, text: 'Decisión sensata: volverás al cien por cien.' } },
      ],
    });
  }
  return events;
}

// ---------------------------------------------------------------------------
// Ofertas y contratos
// ---------------------------------------------------------------------------

function offerRole(ovr: number, clubStrength: number): ContractRole {
  const diff = ovr - clubStrength;
  if (diff >= 10) return 'estrella';
  if (diff >= 3) return 'titular';
  if (diff >= -5) return 'rotacion';
  return 'suplente';
}

function generateOffers(state: CareerState, rng: Rng, count: number): TransferOffer[] {
  const p = state.player;
  const ovr = overall(p);
  const offers: TransferOffer[] = [];
  const usedNames = new Set<string>([state.club.name]);

  for (let i = 0; i < count; i++) {
    // Nivel del club interesado según reputación y nivel del jugador.
    const appeal = clamp((ovr + p.reputacion) / 2 + randInt(rng, -12, 12), 25, 97);
    let tier: 1 | 2 | 3 | 4 | 5;
    if (appeal >= 84) tier = 5;
    else if (appeal >= 72) tier = 4;
    else if (appeal >= 60) tier = 3;
    else if (appeal >= 48) tier = 2;
    else tier = 1;

    let name: string;
    let leagueName: string;
    let country: string;
    if (tier === 5) {
      const elitePool = ELITE_CLUBS.filter((c) => !usedNames.has(c.name));
      if (elitePool.length === 0) continue;
      const elite = pick(rng, elitePool);
      name = elite.name;
      leagueName = elite.league;
      country = elite.country;
    } else {
      const league = pick(rng, LEAGUES);
      const pool = (tier >= 3 ? league.clubs1 : league.clubs2).filter((c) => !usedNames.has(c));
      if (pool.length === 0) continue;
      name = pick(rng, pool);
      leagueName = tier >= 3 ? league.name1 : league.name2;
      country = league.country;
    }
    usedNames.add(name);
    const strength = clamp(35 + tier * 12 + randInt(rng, -5, 5), 35, 95);
    const club = makeClub(name, leagueName, country, tier, strength);
    const role = offerRole(ovr, strength);
    const salaryK = Math.max(1, Math.round((ovr - 40) * tier * 0.9 + p.reputacion * 0.5 + randInt(rng, -5, 10)));
    const pitches: Record<ContractRole, string> = {
      canterano: 'Apuesta de futuro',
      suplente: 'Competencia dura: tendrás que ganarte el sitio',
      rotacion: 'Minutos garantizados dentro de la rotación',
      titular: 'Proyecto deportivo contigo como titular',
      estrella: 'Quieren construir el equipo a tu alrededor',
    };
    offers.push({
      id: `oferta-${i}-${club.id}`,
      club,
      years: randInt(rng, 2, tier >= 4 ? 5 : 4),
      salaryK,
      role,
      pitch: pitches[role],
      european: tier >= 4 || (tier === 3 && chance(rng, 0.4)),
    });
  }
  return offers;
}

// ---------------------------------------------------------------------------
// Selección nacional
// ---------------------------------------------------------------------------

/** Federación que representa (o representaría) el jugador ahora mismo. */
export function representedTeam(state: CareerState): string {
  return state.national.teamCode ?? state.player.primaryNationalityCode;
}

function nationalCheck(state: CareerState, rng: Rng, notes: string[]): void {
  const p = state.player;
  const teamCode = representedTeam(state);
  const natLevel = countryNatLevel(teamCode);
  const barrier = 30 + natLevel * 9;
  if (p.age <= 21 && state.national.level === 'ninguna' && p.reputacion >= barrier * 0.45) {
    state.national.level = 'sub21';
    state.national.teamCode = teamCode;
    addAchievement(state, 'Convocatoria con la sub-21');
    notes.push(`Primera convocatoria con la sub-21 de ${countryName(teamCode)}.`);
    p.moral = clamp(p.moral + 8, 0, 100);
    return;
  }
  if (state.national.level !== 'absoluta' && p.reputacion >= barrier) {
    state.national.level = 'absoluta';
    state.national.teamCode = teamCode;
    addAchievement(state, 'Debut con la selección absoluta');
    notes.push(`¡Debut con la selección absoluta de ${countryName(teamCode)}! Un sueño cumplido.`);
    state.national.caps += 1;
    p.moral = clamp(p.moral + 10, 0, 100);
    p.reputacion = clamp(p.reputacion + 3, 0, 100);
    return;
  }
  if (state.national.level === 'absoluta' && p.reputacion >= barrier * 0.9 && chance(rng, 0.65)) {
    const games = randInt(rng, 1, 2);
    state.national.caps += games;
    if (positionGroup(p.position) !== 'gk' && chance(rng, p.attributes.disparo / 220)) {
      state.national.goals += 1;
      notes.push(`Gol con ${countryName(teamCode)} en la ventana internacional.`);
    } else {
      notes.push(`${games === 1 ? 'Un partido' : 'Dos partidos'} con ${countryName(teamCode)} en la ventana internacional.`);
    }
  }
}

function summerTournament(state: CareerState, rng: Rng, notes: string[]): void {
  if (state.national.level !== 'absoluta') return;
  const teamCode = representedTeam(state);
  const isWorldCup = (state.year - 2026) % 4 === 0;
  const isContinental = (state.year - 2028) % 4 === 0;
  if (!isWorldCup && !isContinental) return;
  const name = isWorldCup ? `Mundial ${state.year}` : continentalTournamentName(confederationOf(teamCode), state.year);
  const natLevel = countryNatLevel(teamCode);
  // La probabilidad de ganar depende sobre todo del nivel de la selección;
  // el jugador aporta, pero no convierte a una selección modesta en campeona.
  const winP = clamp((0.03 * natLevel + state.player.reputacion / 700) * (natLevel / 5), 0.01, 0.3);
  state.national.caps += randInt(rng, 3, 7);
  if (chance(rng, winP)) {
    state.national.tournamentsWon.push(name);
    state.trophies.push(name);
    addAchievement(state, isWorldCup ? 'Campeón del mundo' : 'Campeón continental con la selección');
    notes.push(`¡${name} conquistado con tu selección!`);
    state.player.reputacion = clamp(state.player.reputacion + 12, 0, 100);
  } else {
    notes.push(`Disputaste el ${name}: la selección cayó antes de la final.`);
  }
}

// ---------------------------------------------------------------------------
// Bucle principal
// ---------------------------------------------------------------------------

export function setTraining(prev: CareerState, focus: TrainingFocus): CareerState {
  const state = cloneState(prev);
  state.training = focus;
  return state;
}

export function playJornada(prev: CareerState, approach: MatchApproach, interactive: boolean): CareerState {
  const state = cloneState(prev);
  if (state.screen.type !== 'jornada' || state.retired) return state;
  const rng = rngOf(state);
  const notes: string[] = [];

  // Lesionado: la jornada pasa sin jugar.
  if (state.injury != null && state.injury.weeksOut > 0) {
    state.injury.weeksOut -= 1;
    state.player.fitness = clamp(state.player.fitness + 12, 0, 100);
    state.player.forma = clamp(state.player.forma - 3, 0, 100);
    const recovered = state.injury.weeksOut <= 0;
    if (recovered) {
      notes.push(`Alta médica: superaste la ${state.injury.name.toLowerCase()}.`);
      state.injury = null;
    } else {
      notes.push(`Sigues de baja (${state.injury.name}): ${state.injury.weeksOut} ${state.injury.weeksOut === 1 ? 'jornada' : 'jornadas'} restantes.`);
    }
    const result: MatchResult = {
      jornada: state.jornada,
      rival: rivalName(state, rng),
      rivalStrength: 0,
      home: false,
      golesFavor: randInt(rng, 0, 3),
      golesContra: randInt(rng, 0, 3),
      titular: false,
      minutos: 0,
      goles: 0,
      asistencias: 0,
      tiros: 0,
      pases: 0,
      recuperaciones: 0,
      paradas: 0,
      porteriaCero: false,
      amarilla: false,
      roja: false,
      rating: 0,
      headline: 'Jornada en la enfermería.',
    };
    state.leaguePos = clamp(state.leaguePos + randInt(rng, -1, 1), 1, 20);
    state.screen = { type: 'resultado', result, notes };
    saveRng(state, rng);
    return state;
  }

  const ctx: SimContext = { rng, approach, interactive };
  const result = baseMatch(state, ctx);

  if (interactive && result.minutos >= 45 && !state.retired) {
    const moment = makeMoment(state, rng);
    if (moment != null) {
      state.screen = { type: 'momento', moment, partial: result };
      saveRng(state, rng);
      return state;
    }
  }

  finishMatch(state, result, rng, notes);
  saveRng(state, rng);
  return state;
}

export function resolveMoment(prev: CareerState, optionId: string): CareerState {
  const state = cloneState(prev);
  if (state.screen.type !== 'momento') return state;
  const rng = rngOf(state);
  const { moment, partial } = state.screen;
  const option = moment.options.find((o) => o.id === optionId) ?? moment.options[0]!;
  const success = chance(rng, option.successP);
  const effect = success ? option.success : option.failure;
  const notes: string[] = [effect.text];

  partial.goles += effect.goles ?? 0;
  partial.asistencias += effect.asistencias ?? 0;
  partial.tiros += effect.tiros ?? 0;
  partial.paradas += effect.paradas ?? 0;
  partial.recuperaciones += effect.recuperaciones ?? 0;
  if ((effect.goles ?? 0) > 0) partial.golesFavor += effect.goles ?? 0;
  if (effect.tarjetaP != null && chance(rng, effect.tarjetaP)) partial.amarilla = true;
  state.player.moral = clamp(state.player.moral + effect.moral, 0, 100);
  state.player.reputacion = clamp(state.player.reputacion + (effect.reputacion ?? 0), 0, 100);
  if (effect.lesionP != null && state.injury == null && chance(rng, effect.lesionP)) {
    rollInjury(state, rng, true);
    notes.push('La jugada acabó con problemas físicos.');
  }
  partial.rating = clamp(ratingFor(state, partial) + effect.rating * 0.5, 3, 10);

  finishMatch(state, partial, rng, notes);
  saveRng(state, rng);
  return state;
}

function finishMatch(state: CareerState, result: MatchResult, rng: Rng, notes: string[]): void {
  result.headline = headline(state, result);
  applyMatchToState(state, result, rng, notes);
  applyWeeklyTraining(state, rng, result.minutos, notes);
  if (result.goles > 0 && state.careerTotals.goles === 0 && state.stats.goles === result.goles) {
    addAchievement(state, 'Primer gol como profesional');
  }
  refreshValue(state);
  log(
    state,
    `J${result.jornada}: ${result.minutos > 0 ? `${result.rating.toFixed(1)} de nota` : 'sin minutos'} · ${result.golesFavor}-${result.golesContra} vs ${result.rival}`,
    'partido',
  );
  state.screen = { type: 'resultado', result, notes };
}

export function continueFromResult(prev: CareerState): CareerState {
  const state = cloneState(prev);
  if (state.screen.type !== 'resultado' && state.screen.type !== 'evento') return state;
  const rng = rngOf(state);
  const notes: string[] = [];

  if (state.retired) {
    state.screen = { type: 'finCarrera' };
    saveRng(state, rng);
    return state;
  }

  state.jornada += 1;

  // Fin de temporada.
  if (state.jornada > state.totalJornadas) {
    endSeason(state, rng);
    saveRng(state, rng);
    return state;
  }

  // Ventana internacional (jornadas 8 y 22).
  if (state.jornada === 8 || state.jornada === 22) {
    nationalCheck(state, rng, notes);
    for (const n of notes) log(state, n, 'seleccion');
  }

  // Mercado de invierno: ofertas a mitad de temporada si hay interés.
  if (state.jornada === 15 && state.player.reputacion > 25 && chance(rng, 0.45)) {
    const offers = generateOffers(state, rng, randInt(rng, 1, 2));
    if (offers.length > 0) {
      state.screen = { type: 'ofertas', offers, canStay: true, reason: 'Mercado de invierno: hay clubes interesados en ti.' };
      saveRng(state, rng);
      return state;
    }
  }

  // Evento narrativo cada pocas jornadas.
  if (state.jornada % 4 === 2 && chance(rng, 0.75)) {
    const pool = narrativePool(state, rng);
    if (pool.length > 0) {
      state.screen = { type: 'evento', event: pick(rng, pool) };
      saveRng(state, rng);
      return state;
    }
  }

  state.screen = { type: 'jornada' };
  saveRng(state, rng);
  return state;
}

export function resolveEvent(prev: CareerState, optionId: string): CareerState {
  const state = cloneState(prev);
  if (state.screen.type !== 'evento') return state;
  const rng = rngOf(state);
  const event = state.screen.event;
  const option = event.options.find((o) => o.id === optionId) ?? event.options[0]!;
  const fx = option.effects;
  const p = state.player;
  p.moral = clamp(p.moral + (fx.moral ?? 0), 0, 100);
  p.forma = clamp(p.forma + (fx.forma ?? 0), 0, 100);
  p.fitness = clamp(p.fitness + (fx.fitness ?? 0), 0, 100);
  p.reputacion = clamp(p.reputacion + (fx.reputacion ?? 0), 0, 100);
  p.coachTrust = clamp(p.coachTrust + (fx.coachTrust ?? 0), 0, 100);
  if (fx.salaryK != null && fx.salaryK > 0) {
    state.contract.salaryK += fx.salaryK;
    if (event.id === 'renovacion' && optionId === 'renovar') state.contract.yearsLeft = 3;
  }
  if (fx.devBoost != null) {
    const targets = TRAINING_TARGETS[state.training];
    for (let i = 0; i < fx.devBoost; i++) {
      const key = targets.length > 0 ? pick(rng, targets) : pick(rng, ['fisico', 'resistencia'] as const);
      p.attributes[key] = clamp(p.attributes[key] + 1, 1, Math.min(99, p.potential + 2));
    }
  }
  if (fx.injuryP != null && state.injury == null && chance(rng, fx.injuryP)) {
    rollInjury(state, rng, true);
  }
  if (fx.chooseNationalTeam != null) {
    state.national.teamCode =
      fx.chooseNationalTeam === 'secundaria' && p.secondaryNationalityCode != null
        ? p.secondaryNationalityCode
        : p.primaryNationalityCode;
  }
  if (event.id === 'infiltrarse' && optionId === 'jugar' && state.injury != null) {
    state.injury.weeksOut = 0;
    state.injury = null;
  }
  log(state, `${event.title}: ${fx.text}`, 'evento');
  // El evento ocurre entre jornadas: volvemos al flujo de jornada sin avanzar.
  state.screen = { type: 'jornada' };
  saveRng(state, rng);
  return state;
}

export function resolveOffer(prev: CareerState, offerId: string | 'quedarse'): CareerState {
  const state = cloneState(prev);
  if (state.screen.type !== 'ofertas') return state;
  const rng = rngOf(state);
  const { offers } = state.screen;

  if (offerId === 'quedarse') {
    log(state, `Rechazaste las ofertas y sigues en el ${state.club.name}.`, 'contrato');
    state.player.coachTrust = clamp(state.player.coachTrust + 5, 0, 100);
    if (state.contract.yearsLeft <= 0) state.contract.yearsLeft = 2;
  } else {
    const offer = offers.find((o) => o.id === offerId);
    if (offer != null) {
      state.club = offer.club;
      state.division = offer.club.tier >= 3 ? 1 : 2;
      state.contract = { clubId: offer.club.id, yearsLeft: offer.years, salaryK: offer.salaryK, role: offer.role };
      state.player.coachTrust = 45;
      state.player.moral = clamp(state.player.moral + 8, 0, 100);
      state.player.reputacion = clamp(state.player.reputacion + offer.club.tier, 0, 100);
      state.leaguePos = randInt(rng, 5, 15);
      log(state, `Fichaje por el ${offer.club.name} (${offer.club.league}) · ${offer.years} años.`, 'contrato');
      if (offer.club.tier >= 4) addAchievement(state, 'Fichaje por un grande de Europa');
    }
  }
  state.screen = { type: 'jornada' };
  saveRng(state, rng);
  return state;
}

// ---------------------------------------------------------------------------
// Fin de temporada
// ---------------------------------------------------------------------------

function evaluateObjectives(state: CareerState): void {
  const s = state.stats;
  const avg = s.ratingCount > 0 ? s.ratingSum / s.ratingCount : 0;
  for (const o of state.objectives) {
    switch (o.kind) {
      case 'minutos':
        o.done = s.minutos >= o.target;
        break;
      case 'goles':
        o.done = s.goles >= o.target;
        break;
      case 'asistencias':
        o.done = s.asistencias >= o.target;
        break;
      case 'porteriasCero':
        o.done = s.porteriasCero >= o.target;
        break;
      case 'valoracion':
        o.done = avg >= o.target;
        break;
      case 'titulo':
        o.done = state.leaguePos === 1;
        break;
      case 'clasificacionEuropea':
        o.done = state.leaguePos <= o.target;
        break;
      case 'evitarDescenso':
        o.done = state.leaguePos < o.target;
        break;
      case 'convocatoriaSeleccion':
        o.done = state.national.level !== 'ninguna';
        break;
    }
  }
}

function seasonAwards(state: CareerState, rng: Rng, notes: string[]): string[] {
  const titles: string[] = [];
  const s = state.stats;
  const avg = s.ratingCount > 0 ? s.ratingSum / s.ratingCount : 0;

  if (state.leaguePos === 1) {
    const title = state.division === 1 ? `${state.club.league} ${state.year}` : `Ascenso y título de ${state.club.league} ${state.year}`;
    titles.push(title);
    state.trophies.push(title);
    addAchievement(state, 'Primer título');
    notes.push(`¡Campeones! ${title}.`);
  } else if (state.division === 2 && state.leaguePos <= 3) {
    notes.push('¡Ascenso conseguido! El año que viene, primera división.');
  } else if (state.leaguePos >= 18 && state.division === 1) {
    notes.push('El equipo desciende. Temporada dolorosa.');
  }

  // Copa doméstica ocasional en clubes fuertes.
  if (state.division === 1 && state.club.tier >= 3 && chance(rng, 0.12 + state.club.tier * 0.03)) {
    const cup = `Copa Nacional ${state.year}`;
    titles.push(cup);
    state.trophies.push(cup);
    notes.push(`El equipo levanta la ${cup}.`);
  }
  // Competición europea.
  if (state.club.tier >= 4 && chance(rng, 0.08 + (state.club.tier - 4) * 0.06)) {
    const cup = `Copa Continental de Clubes ${state.year}`;
    titles.push(cup);
    state.trophies.push(cup);
    addAchievement(state, 'Campeón continental de clubes');
    notes.push(`¡Gloria europea! ${cup}.`);
  }

  const positionGoals = positionGroup(state.player.position) === 'att' ? 18 : 12;
  if (s.goles >= positionGoals && state.division === 1) {
    addAchievement(state, 'Máximo goleador de la liga');
    notes.push('Terminas la temporada como máximo goleador de la liga.');
    state.player.reputacion = clamp(state.player.reputacion + 8, 0, 100);
  }
  if (avg >= 7.5 && s.titularidades >= 20 && state.division === 1) {
    addAchievement(state, 'Mejor jugador de la liga');
    notes.push('La prensa te elige mejor jugador de la temporada.');
    state.player.reputacion = clamp(state.player.reputacion + 10, 0, 100);
  }
  if (avg >= 7.6 && state.club.tier >= 4 && state.national.level === 'absoluta' && chance(rng, 0.3)) {
    addAchievement(state, 'Premio individual global');
    notes.push('¡Ganas el gran premio individual del fútbol mundial!');
    state.player.reputacion = 100;
  }
  if (state.player.age >= 27 && state.player.coachTrust >= 85) {
    addAchievement(state, 'Capitán del equipo');
  }
  return titles;
}

function endSeason(state: CareerState, rng: Rng): void {
  const notes: string[] = [];
  evaluateObjectives(state);
  const titles = seasonAwards(state, rng, notes);
  nationalCheck(state, rng, notes);
  summerTournament(state, rng, notes);

  const s = state.stats;
  const avg = s.ratingCount > 0 ? Math.round((s.ratingSum / s.ratingCount) * 100) / 100 : 0;
  const summary: SeasonSummary = {
    year: state.year,
    age: state.player.age,
    clubName: state.club.name,
    league: state.club.league,
    division: state.division,
    stats: { ...s },
    avgRating: avg,
    leaguePosition: state.leaguePos,
    titles,
    objectivesMet: state.objectives.filter((o) => o.done).length,
    objectivesTotal: state.objectives.length,
  };
  state.history.push(summary);

  // Acumular totales.
  const t = state.careerTotals;
  t.pj += s.pj;
  t.titularidades += s.titularidades;
  t.minutos += s.minutos;
  t.goles += s.goles;
  t.asistencias += s.asistencias;
  t.tiros += s.tiros;
  t.pases += s.pases;
  t.recuperaciones += s.recuperaciones;
  t.paradas += s.paradas;
  t.porteriasCero += s.porteriasCero;
  t.amarillas += s.amarillas;
  t.rojas += s.rojas;
  t.ratingSum += s.ratingSum;
  t.ratingCount += s.ratingCount;

  log(state, `Temporada ${state.year}: ${s.pj} PJ, ${s.goles} goles, ${s.asistencias} asistencias, nota media ${avg.toFixed(2)}.`, 'temporada');
  state.screen = { type: 'finTemporada', summary, notes };
}

/** Avanza de la pantalla de fin de temporada a la siguiente temporada (o al final). */
export function startNextSeason(prev: CareerState, wantsRetire: boolean): CareerState {
  const state = cloneState(prev);
  if (state.screen.type !== 'finTemporada') return state;
  const rng = rngOf(state);
  const p = state.player;

  // Retirada.
  const noOffersEnd = state.contract.yearsLeft <= 1 && overall(p) < 55 && p.age >= 34;
  if (wantsRetire || p.age + 1 >= MAX_AGE || state.retired || noOffersEnd) {
    state.retired = true;
    state.retirementReason =
      state.retirementReason ??
      (wantsRetire
        ? 'Retirada por decisión propia, con la cabeza alta.'
        : p.age + 1 >= MAX_AGE
          ? 'El cuerpo dijo basta: retirada a los 40.'
          : 'Sin ofertas sobre la mesa, llegó el momento de colgar las botas.');
    state.screen = { type: 'finCarrera' };
    saveRng(state, rng);
    return state;
  }

  // Ascenso/descenso.
  if (state.division === 2 && state.leaguePos <= 3) {
    state.division = 1;
    state.club = { ...state.club, league: leagueFor(state.club.country).name1, tier: Math.max(state.club.tier, 2) as Club['tier'], strength: clamp(state.club.strength + 8, 40, 95) };
  } else if (state.division === 1 && state.leaguePos >= 18 && state.club.tier <= 2) {
    state.division = 2;
    state.club = { ...state.club, league: leagueFor(state.club.country).name2, strength: clamp(state.club.strength - 6, 35, 95) };
  }

  // Nueva temporada.
  state.year += 1;
  state.seasonIndex += 1;
  state.jornada = 1;
  p.age += 1;
  state.contract.yearsLeft -= 1;
  p.fitness = clamp(p.fitness + 25, 0, 100);
  p.forma = 50;
  state.stats = emptySeasonStats();
  state.leaguePos = randInt(rng, 6, 14);

  // Rol según nivel actual.
  state.contract.role = offerRole(overall(p), state.club.strength);
  if (p.age <= 18 && state.contract.role === 'suplente') state.contract.role = 'canterano';

  state.objectives = seasonObjectives(state, rng);
  refreshValue(state);

  // Mercado de verano: contrato vencido → ofertas obligatorias; si no, interés opcional.
  if (state.contract.yearsLeft <= 0) {
    const offers = generateOffers(state, rng, randInt(rng, 2, 3));
    state.screen = {
      type: 'ofertas',
      offers,
      canStay: overall(p) >= state.club.strength - 12,
      reason: 'Tu contrato ha terminado: decide tu futuro.',
    };
    if (offers.length === 0 && overall(p) < state.club.strength - 12) {
      state.retired = true;
      state.retirementReason = 'Ningún club presentó una oferta. La carrera termina en silencio.';
      state.screen = { type: 'finCarrera' };
    }
  } else if (p.reputacion > 40 && chance(rng, 0.5)) {
    const offers = generateOffers(state, rng, randInt(rng, 1, 3));
    if (offers.length > 0) {
      state.screen = { type: 'ofertas', offers, canStay: true, reason: 'Mercado de verano: varios clubes llaman a tu puerta.' };
    } else {
      state.screen = { type: 'jornada' };
    }
  } else {
    state.screen = { type: 'jornada' };
  }
  saveRng(state, rng);
  return state;
}

export function retireNow(prev: CareerState): CareerState {
  const state = cloneState(prev);
  state.retired = true;
  state.retirementReason = 'Retirada por decisión propia.';
  state.screen = { type: 'finCarrera' };
  return state;
}

// ---------------------------------------------------------------------------
// Simulación rápida (varias jornadas sin decisiones)
// ---------------------------------------------------------------------------

export function simulateBlock(prev: CareerState, count: number): CareerState {
  let state = prev;
  for (let i = 0; i < count; i++) {
    if (state.screen.type !== 'jornada' || state.retired) break;
    state = playJornada(state, 'seguro', false);
    if (state.screen.type === 'resultado') {
      state = continueFromResult(state);
      // Si aparece un evento u ofertas, la simulación rápida se detiene ahí.
      if (state.screen.type !== 'jornada') break;
    } else {
      break;
    }
  }
  return state;
}

// ---------------------------------------------------------------------------
// Tarjeta final y puntuación
// ---------------------------------------------------------------------------

function legendLevel(score: number): LegendLevel {
  if (score >= 1500) return 'Leyenda mundial';
  if (score >= 1150) return 'Leyenda';
  if (score >= 850) return 'Ídolo';
  if (score >= 550) return 'Figura';
  if (score >= 300) return 'Referente';
  return 'Profesional';
}

function computeRecords(state: CareerState): string[] {
  const records: string[] = [];
  const t = state.careerTotals;
  let bestGoals = 0;
  let bestRating = 0;
  for (const h of state.history) {
    if (h.stats.goles > bestGoals) bestGoals = h.stats.goles;
    if (h.avgRating > bestRating) bestRating = h.avgRating;
  }
  if (bestGoals >= 25) records.push(`${bestGoals} goles en una sola temporada`);
  if (bestRating >= 7.8) records.push(`Nota media de ${bestRating.toFixed(2)} en una temporada`);
  if (t.goles >= 300) records.push('Más de 300 goles como profesional');
  else if (t.goles >= 150) records.push('Más de 150 goles como profesional');
  if (t.pj >= 500) records.push('Más de 500 partidos oficiales');
  if (state.national.caps >= 100) records.push('Centenario con la selección');
  if (state.history.length >= 18) records.push(`${state.history.length} temporadas de carrera`);
  return records;
}

export function buildCareerCard(state: CareerState): CareerCard {
  const t = state.careerTotals;
  const avg = t.ratingCount > 0 ? Math.round((t.ratingSum / t.ratingCount) * 100) / 100 : 0;
  const clubs = Array.from(new Set(state.history.map((h) => h.clubName)));
  const records = computeRecords(state);

  // Puntuación: rendimiento + consistencia + títulos + premios + dificultad.
  const objectivesMet = state.history.reduce((acc, h) => acc + h.objectivesMet, 0);
  const titleScore = state.trophies.reduce((acc, title) => {
    if (title.startsWith('Mundial')) return acc + 120;
    if (title.includes('Continental de Clubes')) return acc + 90;
    if (title.includes('Torneo Continental')) return acc + 80;
    if (title.includes('Copa Nacional')) return acc + 35;
    return acc + 55;
  }, 0);
  const awardScore =
    (state.achievements.includes('Premio individual global') ? 120 : 0) +
    (state.achievements.includes('Mejor jugador de la liga') ? 60 : 0) +
    (state.achievements.includes('Máximo goleador de la liga') ? 45 : 0) +
    (state.achievements.includes('Capitán del equipo') ? 20 : 0);
  const perfScore = Math.min(220, t.pj * 0.25 + t.goles * 0.6 + t.asistencias * 0.45 + t.paradas * 0.06 + t.porteriasCero * 1.2);
  const consistencyScore = avg > 0 ? clamp((avg - 6) * 90, 0, 180) : 0;
  const natScore = state.national.caps * 0.5 + state.national.goals * 2;
  const recordScore = records.length * 18;
  const raw = (perfScore + consistencyScore + titleScore + awardScore + natScore + recordScore + objectivesMet * 4) * difficultyMult(state.difficulty);
  const score = Math.round(raw);

  return {
    id: state.id,
    finishedAt: new Date().toISOString(),
    name: state.player.name,
    position: state.player.position,
    countryCode: state.player.primaryNationalityCode,
    countryName: countryName(state.player.primaryNationalityCode),
    nationalTeamCode: state.national.teamCode,
    seasons: state.history.length,
    clubs,
    pj: t.pj,
    goles: t.goles,
    asistencias: t.asistencias,
    paradas: t.paradas,
    porteriasCero: t.porteriasCero,
    avgRating: avg,
    titles: [...state.trophies],
    achievements: [...state.achievements],
    caps: state.national.caps,
    capGoals: state.national.goals,
    maxValueM: state.player.maxValueM,
    records,
    score,
    legendLevel: legendLevel(score),
    difficulty: state.difficulty,
    retirementReason: state.retirementReason ?? 'Fin de carrera.',
  };
}
