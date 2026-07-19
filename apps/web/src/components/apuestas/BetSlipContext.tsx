'use client';

/**
 * Estado del cupón de apuestas simuladas, persistido en localStorage para
 * conservar las selecciones al navegar. Sin dinero real.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BetSelection } from '@futstats/stats';
import { loadJson, saveJson, SLIP_KEY } from './betTypes';

interface BetSlipState {
  selections: BetSelection[];
  hydrated: boolean;
  add: (s: BetSelection) => void;
  remove: (matchId: number, market: string, option: string) => void;
  setOdds: (matchId: number, market: string, option: string, odds: number) => void;
  clear: () => void;
  has: (matchId: number, market: string, option: string) => boolean;
}

const Ctx = createContext<BetSlipState | null>(null);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSelections(loadJson<BetSelection[]>(SLIP_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveJson(SLIP_KEY, selections);
  }, [selections, hydrated]);

  const value = useMemo<BetSlipState>(() => {
    const key = (m: number, market: string, option: string) => `${m}|${market}|${option}`;
    return {
      selections,
      hydrated,
      add: (s) =>
        setSelections((prev) =>
          prev.some((p) => key(p.matchId, p.market, p.option) === key(s.matchId, s.market, s.option))
            ? prev
            : [...prev, s],
        ),
      remove: (matchId, market, option) =>
        setSelections((prev) => prev.filter((p) => key(p.matchId, p.market, p.option) !== key(matchId, market, option))),
      setOdds: (matchId, market, option, odds) =>
        setSelections((prev) =>
          prev.map((p) => (key(p.matchId, p.market, p.option) === key(matchId, market, option) ? { ...p, odds } : p)),
        ),
      clear: () => setSelections([]),
      has: (matchId, market, option) =>
        selections.some((p) => key(p.matchId, p.market, p.option) === key(matchId, market, option)),
    };
  }, [selections, hydrated]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBetSlip(): BetSlipState {
  const ctx = useContext(Ctx);
  if (ctx == null) throw new Error('useBetSlip debe usarse dentro de BetSlipProvider');
  return ctx;
}
