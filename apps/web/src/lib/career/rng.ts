/**
 * Generador pseudoaleatorio determinista (mulberry32).
 * El estado se guarda en la partida para que la simulación sea reproducible
 * a partir de una semilla, sin depender de Math.random().
 */

export interface Rng {
  /** Devuelve un número en [0, 1). Muta el estado interno. */
  next(): number;
  /** Estado serializable actual. */
  state(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state(): number {
      return a;
    },
  };
}

/** Semilla a partir de un texto (hash FNV-1a). */
export function seedFromText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Semilla aleatoria para nuevas partidas. */
export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/** Entero uniforme en [min, max] (ambos incluidos). */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}

/** Elemento aleatorio de una lista no vacía. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng.next() * items.length)];
  if (item === undefined) throw new Error('pick: lista vacía');
  return item;
}

/** true con probabilidad p (0..1). */
export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p;
}

/** Valor limitado al rango [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
