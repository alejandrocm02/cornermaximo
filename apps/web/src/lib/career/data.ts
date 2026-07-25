/**
 * Datos ficticios del Modo Carrera.
 * Todos los clubes, ligas y nombres son inventados y claramente diferenciados
 * de entidades reales para respetar licencias de datos y marcas.
 */
import type { Archetype, Attributes, Club, Position } from './types';

/** Países con liga jugable de inicio (códigos estables; ver countries.ts). */
export const START_COUNTRIES = ['ES', 'GB-ENG', 'FR', 'DE', 'IT', 'PT'] as const;

interface LeagueDef {
  country: string;
  name1: string;
  name2: string;
  clubs1: string[];
  clubs2: string[];
}

/** Ligas y clubes ficticios por país. */
export const LEAGUES: LeagueDef[] = [
  {
    country: 'ES',
    name1: 'Liga Ibérica',
    name2: 'Segunda Ibérica',
    clubs1: [
      'Real Meridiano',
      'Atlético Faro',
      'CD Levantina',
      'Sporting Almadraba',
      'Racing Duero',
      'UD Miramar',
      'Celta del Cierzo',
      'Deportivo Alcazaba',
    ],
    clubs2: [
      'CD Cierzo B',
      'Atlético Ribera',
      'UD Salinas',
      'Real Páramo',
      'Gimnástica Costa',
      'CP Dehesa',
      'Peña Roqueta',
      'CD Albariza',
    ],
  },
  {
    country: 'GB-ENG',
    name1: 'Liga Albión',
    name2: 'Championship Albión',
    clubs1: [
      'Northbridge FC',
      'Redmoor United',
      'Blackwell City',
      'Harborough Town',
      'Eastcliff Rovers',
      'Kingsholt Athletic',
      'Westmere Wanderers',
      'Ironvale FC',
    ],
    clubs2: [
      'Greyfield Rangers',
      'Oakhampton FC',
      'Millbrook Albion',
      'Stonegate United',
      'Ferrymouth Town',
      'Larkhall City',
      'Duncastle FC',
      'Wrenford Athletic',
    ],
  },
  {
    country: 'FR',
    name1: 'Ligue Hexagone',
    name2: 'Division Hexagone 2',
    clubs1: [
      'Paris Boréal',
      'Olympique Mistral',
      'Racing Garonne',
      'AS Verdoyant',
      'FC Roche-Marine',
      'Stade Lumière',
      'Girondins du Vent',
      'Toulon Azur',
    ],
    clubs2: [
      'US Bocage',
      'FC Ardoise',
      'Étoile de Brume',
      'AS Calanque',
      'Racing Vosgien',
      'Stade Falaise',
      'Olympique Sablon',
      'FC Rivage',
    ],
  },
  {
    country: 'DE',
    name1: 'Bundesliga Adler',
    name2: 'Zweite Adler',
    clubs1: [
      'Bayern Silberberg',
      'Borussia Eisenwald',
      'SV Nordstern',
      'FC Rheingold',
      'Eintracht Falkenau',
      'Werder Sturmsee',
      'VfB Steinburg',
      'Hertha Lindenau',
    ],
    clubs2: [
      'SC Kohlental',
      'FC Nebelhorn',
      'SpVgg Dachsbau',
      'SV Birkenfeld',
      'TSV Móosbach',
      'FC Uferstadt',
      'Union Waldkirch',
      'Alemannia Grauburg',
    ],
  },
  {
    country: 'IT',
    name1: 'Serie Aurea',
    name2: 'Serie Argento',
    clubs1: [
      'Juventus del Lago',
      'Inter Vesuvio',
      'AC Marmo',
      'Roma Aurelia',
      'Fiorentina del Colle',
      'Atalanta Brembana',
      'Napoli Sirena',
      'Torino Sabaudo',
    ],
    clubs2: [
      'US Tramonto',
      'Calcio Riviera',
      'AC Campanile',
      'Virtus Oliveto',
      'Pro Collina',
      'US Faro Ligure',
      'Ternana del Bosco',
      'Spezia Corsara',
    ],
  },
  {
    country: 'PT',
    name1: 'Liga Atlântica',
    name2: 'Segunda Atlântica',
    clubs1: [
      'Benfica do Cabo',
      'Sporting Maré',
      'FC Granito',
      'Boavista do Sul',
      'Vitória Costeira',
      'Marítimo Azulejo',
      'Braga Nascente',
      'Estrela do Tejo',
    ],
    clubs2: [
      'Académica do Vale',
      'CD Rochedo',
      'União Serrana',
      'Leixões do Norte',
      'Farense Dourado',
      'CD Gaivota',
      'Portimão Salgado',
      'Varzim Bravio',
    ],
  },
];

export function leagueFor(country: string): LeagueDef {
  return LEAGUES.find((l) => l.country === country) ?? LEAGUES[0]!;
}

/** Grandes clubes europeos ficticios para ofertas de máximo nivel (tier 5). */
export const ELITE_CLUBS: Array<{ name: string; country: string; league: string }> = [
  { name: 'Real Meridiano', country: 'ES', league: 'Liga Ibérica' },
  { name: 'Northbridge FC', country: 'GB-ENG', league: 'Liga Albión' },
  { name: 'Paris Boréal', country: 'FR', league: 'Ligue Hexagone' },
  { name: 'Bayern Silberberg', country: 'DE', league: 'Bundesliga Adler' },
  { name: 'Juventus del Lago', country: 'IT', league: 'Serie Aurea' },
];

let clubSeq = 0;

export function makeClub(name: string, league: string, country: string, tier: 1 | 2 | 3 | 4 | 5, strength: number): Club {
  clubSeq += 1;
  return { id: `club-${clubSeq}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, short: name.split(' ')[0] ?? name, league, country, tier, strength };
}

/** Atributos iniciales por arquetipo (base juvenil, 16 años). */
export const ARCHETYPE_BASES: Record<Archetype, Partial<Attributes>> = {
  goleador: { disparo: 62, ritmo: 55, tecnica: 50, pase: 42, regate: 48, defensa: 25, fisico: 50, vision: 45, concentracion: 52, resistencia: 48 },
  creador: { pase: 62, vision: 62, tecnica: 56, disparo: 42, regate: 50, defensa: 30, fisico: 40, ritmo: 46, concentracion: 52, resistencia: 46 },
  regateador: { regate: 63, ritmo: 60, tecnica: 55, disparo: 45, pase: 45, defensa: 22, fisico: 40, vision: 46, concentracion: 44, resistencia: 50 },
  organizador: { pase: 58, vision: 55, concentracion: 58, defensa: 45, tecnica: 50, disparo: 38, regate: 42, fisico: 46, ritmo: 42, resistencia: 54 },
  recuperador: { defensa: 58, fisico: 56, resistencia: 58, concentracion: 52, pase: 44, ritmo: 48, tecnica: 38, disparo: 30, regate: 34, vision: 40 },
  defensor: { defensa: 62, fisico: 60, concentracion: 55, ritmo: 44, pase: 40, tecnica: 34, disparo: 26, regate: 26, vision: 38, resistencia: 52 },
  reflejos: { concentracion: 55, fisico: 48, ritmo: 40, resistencia: 46, pase: 30, tecnica: 30, disparo: 20, regate: 20, defensa: 30, vision: 38 },
  completo: { ritmo: 50, tecnica: 50, pase: 50, disparo: 48, regate: 48, defensa: 44, fisico: 50, vision: 48, concentracion: 50, resistencia: 50 },
};

/** Base de atributos de portero (solo relevantes para POR). */
export const GK_BASES: Record<'reflejos' | 'otros', Partial<Attributes>> = {
  reflejos: { reflejos: 62, colocacion: 50, blocaje: 52, aereo: 46, salida: 42, pies: 34 },
  otros: { reflejos: 50, colocacion: 50, blocaje: 48, aereo: 46, salida: 44, pies: 44 },
};

/** Pesos de valoración media (OVR) por posición. */
export const OVR_WEIGHTS: Record<Position, Partial<Record<keyof Attributes, number>>> = {
  POR: { reflejos: 0.3, colocacion: 0.2, blocaje: 0.15, aereo: 0.1, salida: 0.1, pies: 0.05, concentracion: 0.1 },
  DFC: { defensa: 0.3, fisico: 0.2, concentracion: 0.15, ritmo: 0.1, pase: 0.1, resistencia: 0.1, tecnica: 0.05 },
  LAT: { ritmo: 0.22, defensa: 0.2, resistencia: 0.15, pase: 0.13, regate: 0.1, fisico: 0.1, concentracion: 0.1 },
  MC: { pase: 0.22, vision: 0.16, resistencia: 0.14, defensa: 0.12, tecnica: 0.12, concentracion: 0.12, fisico: 0.12 },
  MCO: { pase: 0.2, vision: 0.2, tecnica: 0.18, regate: 0.14, disparo: 0.14, ritmo: 0.08, concentracion: 0.06 },
  EXT: { ritmo: 0.22, regate: 0.22, tecnica: 0.14, disparo: 0.14, pase: 0.12, vision: 0.08, resistencia: 0.08 },
  DEL: { disparo: 0.28, ritmo: 0.18, tecnica: 0.14, fisico: 0.12, regate: 0.1, concentracion: 0.1, vision: 0.08 },
};

export const INJURIES: Array<{ name: string; min: number; max: number; grave: boolean }> = [
  { name: 'Sobrecarga muscular', min: 1, max: 1, grave: false },
  { name: 'Esguince de tobillo', min: 1, max: 3, grave: false },
  { name: 'Rotura fibrilar', min: 2, max: 4, grave: false },
  { name: 'Lesión de isquios', min: 3, max: 5, grave: false },
  { name: 'Fractura de metatarso', min: 6, max: 9, grave: true },
  { name: 'Rotura de ligamento cruzado', min: 16, max: 24, grave: true },
];

export const RIVAL_ADJECTIVES = ['sólido', 'agresivo', 'ordenado', 'vertical', 'rocoso', 'talentoso', 'irregular', 'físico'];

export const FIRST_NAMES = ['Álex', 'Dani', 'Hugo', 'Iker', 'Leo', 'Marco', 'Nico', 'Pablo', 'Samu', 'Teo'];
export const LAST_NAMES = ['Serrano', 'Valdés', 'Roca', 'Navarro', 'Camps', 'Iglesias', 'Duarte', 'Peral', 'Sosa', 'Lemos'];
