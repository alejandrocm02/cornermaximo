'use client';

/**
 * Sección de apuestas: lista de partidos con mercados + cupón.
 * Escritorio: cupón en columna lateral. Móvil: panel inferior con botón fijo
 * que muestra el número de selecciones (cierre con Escape y botón).
 */
import { useEffect, useRef, useState } from 'react';
import { BET_MARKETS, type BetMarketId } from '@futstats/stats';
import { BetSlipProvider, useBetSlip } from './BetSlipContext';
import { BetSlip } from './BetSlip';

export interface UpcomingMatch {
  id: number;
  competition: string;
  round: string | null;
  kickoffAt: string; // ISO
  home: string;
  away: string;
}

function MatchCard({ match }: { match: UpcomingMatch }) {
  const slip = useBetSlip();
  const label = `${match.home} – ${match.away}`;
  return (
    <article className="fs-panel p-4 text-sm">
      <p className="text-xs text-pitch-muted">
        {match.competition}
        {match.round != null && ` · ${match.round}`} ·{' '}
        <time dateTime={match.kickoffAt}>
          {new Date(match.kickoffAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
        </time>
      </p>
      <h3 className="mt-1 font-semibold">{label}</h3>
      <div className="mt-3 space-y-2">
        {(Object.keys(BET_MARKETS) as BetMarketId[]).map((marketId) => {
          const market = BET_MARKETS[marketId];
          return (
            <div key={marketId} className="flex flex-wrap items-center gap-2">
              <span className="w-full text-xs text-pitch-muted sm:w-40">{market.label}</span>
              {Object.entries(market.options as Record<string, string>).map(([optionId, optionLabel]) => {
                const selected = slip.has(match.id, marketId, optionId);
                return (
                  <button
                    key={optionId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      selected
                        ? slip.remove(match.id, marketId, optionId)
                        : slip.add({
                            matchId: match.id,
                            competition: match.competition,
                            matchLabel: label,
                            kickoffAt: match.kickoffAt,
                            market: marketId,
                            option: optionId,
                            odds: 0,
                          })
                    }
                    title={selected ? 'Quitar del cupón' : 'Añadir al cupón'}
                    className={`rounded-lg border px-3 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-pitch-accent ${
                      selected
                        ? 'border-pitch-accent bg-pitch-accent/15 text-pitch-accent'
                        : 'border-pitch-border text-pitch-muted hover:border-pitch-accent hover:text-white'
                    }`}
                  >
                    {selected ? '✓ ' : ''}
                    {optionLabel}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function Inner({ matches }: { matches: UpcomingMatch[] }) {
  const slip = useBetSlip();
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKey);
    panelRef.current?.querySelector<HTMLElement>('button, input')?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  return (
    <div className="lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-6">
      <div className="space-y-3">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
        {matches.length === 0 && (
          <div className="rounded-xl border border-dashed border-pitch-border p-8 text-center text-sm text-pitch-muted">
            <p className="font-medium text-white">No hay partidos programados con estos filtros.</p>
            <p className="mt-1">Prueba con otra liga o vuelve cuando se publique el próximo calendario.</p>
          </div>
        )}
      </div>

      {/* Cupón en escritorio */}
      <div className="mt-6 hidden lg:sticky lg:top-20 lg:mt-0 lg:block">
        <BetSlip />
      </div>

      {/* Cupón en móvil: botón fijo + panel inferior */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={mobileOpen}
          className="fixed bottom-4 right-4 z-40 rounded-full bg-pitch-accent px-5 py-3 text-sm font-semibold text-black shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Cupón ({slip.selections.length})
        </button>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setMobileOpen(false)}>
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Cupón de apuesta simulada"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-pitch-bg p-4 pb-8"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Cupón ({slip.selections.length})</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-pitch-muted hover:text-white focus-visible:ring-2 focus-visible:ring-pitch-accent"
                >
                  Cerrar
                </button>
              </div>
              <BetSlip />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ApuestasClient({ matches }: { matches: UpcomingMatch[] }) {
  return (
    <BetSlipProvider>
      <Inner matches={matches} />
    </BetSlipProvider>
  );
}
