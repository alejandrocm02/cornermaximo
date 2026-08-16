'use client';

/**
 * Historial de apuestas simuladas guardadas en este navegador.
 * Actualiza resultados con el marcador final registrado en CornerMaximo sin
 * modificar retrospectivamente las selecciones ni las cuotas originales.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  BET_MARKETS,
  effectiveOdds,
  impliedProbability,
  resolveBetStatus,
  resolveSelection,
  type BetMarketId,
} from '@cornermaximo/stats';
import {
  BET_STATUS_LABELS,
  BETS_KEY,
  loadJson,
  OUTCOME_LABELS,
  RESPONSIBLE_NOTICE,
  saveJson,
  type SavedBet,
} from './betTypes';

function marketLabel(market: BetMarketId, option: string): string {
  const m = BET_MARKETS[market];
  return `${m.label}: ${(m.options as Record<string, string>)[option] ?? option}`;
}

/** Beneficio o pérdida simulada de una apuesta resuelta con importe. */
function settledProfit(bet: SavedBet): number | null {
  if (bet.stake == null) return null;
  if (bet.status === 'PERDIDA') return -bet.stake;
  if (bet.status === 'ANULADA') return 0;
  if (bet.status === 'GANADA' || bet.status === 'PARCIALMENTE_ANULADA') {
    const odds = effectiveOdds(bet.selections.map((s) => ({ odds: s.odds, outcome: s.outcome })));
    return Math.round((bet.stake * odds - bet.stake) * 100) / 100;
  }
  return null; // pendiente o borrador
}

export function MisApuestasClient() {
  const [bets, setBets] = useState<SavedBet[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [liga, setLiga] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  useEffect(() => {
    setBets(loadJson<SavedBet[]>(BETS_KEY, []));
    setHydrated(true);
  }, []);

  function persist(next: SavedBet[]) {
    setBets(next);
    saveJson(BETS_KEY, next);
  }

  async function updateResults() {
    const pendingIds = [
      ...new Set(
        bets
          .filter((b) => b.status === 'PENDIENTE' || b.status === 'BORRADOR')
          .flatMap((b) => b.selections.filter((s) => s.outcome === 'PENDIENTE').map((s) => s.matchId)),
      ),
    ];
    if (pendingIds.length === 0) {
      setMessage('No hay selecciones pendientes de resolver.');
      return;
    }
    setUpdating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/apuestas/resultados?ids=${pendingIds.join(',')}`);
      if (!res.ok) throw new Error('respuesta no válida');
      const data = (await res.json()) as {
        results: Array<{ id: number; status: string; homeGoals: number | null; awayGoals: number | null }>;
      };
      const byId = new Map(data.results.map((r) => [r.id, r]));
      const next = bets.map((bet) => {
        if (bet.status !== 'PENDIENTE' && bet.status !== 'BORRADOR') return bet;
        const selections = bet.selections.map((s) => {
          if (s.outcome !== 'PENDIENTE') return s;
          const match = byId.get(s.matchId);
          if (match == null) return s;
          return { ...s, outcome: resolveSelection(s, match) };
        });
        return { ...bet, selections, status: resolveBetStatus(selections.map((s) => s.outcome)) };
      });
      persist(next);
      setMessage('Resultados actualizados con el marcador registrado en CornerMaximo.');
    } catch {
      setMessage('No se pudieron consultar los resultados. Inténtalo de nuevo más tarde.');
    } finally {
      setUpdating(false);
    }
  }

  const leagues = useMemo(
    () => [...new Set(bets.flatMap((b) => b.selections.map((s) => s.competition)))].sort(),
    [bets],
  );

  const filtered = bets.filter(
    (b) =>
      (estado === '' || b.status === estado) &&
      (tipo === '' || b.type === tipo) &&
      (liga === '' || b.selections.some((s) => s.competition === liga)),
  );

  // Estadísticas personales sobre apuestas resueltas
  const resolved = bets.filter((b) => ['GANADA', 'PERDIDA', 'ANULADA', 'PARCIALMENTE_ANULADA'].includes(b.status));
  const decided = resolved.filter((b) => b.status !== 'ANULADA');
  const wins = decided.filter((b) => b.status === 'GANADA' || b.status === 'PARCIALMENTE_ANULADA');
  const hitRate = decided.length > 0 ? Math.round((wins.length / decided.length) * 1000) / 10 : null;
  const totalProfit = resolved.reduce((acc, b) => acc + (settledProfit(b) ?? 0), 0);
  const avgOdds =
    bets.length > 0 ? Math.round((bets.reduce((acc, b) => acc + b.totalOdds, 0) / bets.length) * 100) / 100 : null;
  // Racha desde la apuesta resuelta más reciente hacia atrás (bets va de nueva a antigua)
  const streak = (() => {
    let n = 0;
    for (const b of bets) {
      if (b.status === 'GANADA') {
        if (n < 0) break;
        n++;
      } else if (b.status === 'PERDIDA') {
        if (n > 0) break;
        n--;
      }
    }
    return n;
  })();
  const byType = (t: SavedBet['type']) => {
    const list = decided.filter((b) => b.type === t);
    if (list.length === 0) return null;
    const w = list.filter((b) => b.status === 'GANADA' || b.status === 'PARCIALMENTE_ANULADA').length;
    return `${w}/${list.length}`;
  };

  if (!hydrated) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="h-10 animate-pulse rounded-xl bg-pitch-border/40" />
        <div className="h-24 animate-pulse rounded-xl bg-pitch-border/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas personales */}
      {bets.length > 0 && (
        <section aria-label="Estadísticas personales" className="fs-panel p-4 text-sm">
          <h2 className="text-base font-bold">Tus números</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div><dt className="text-xs text-pitch-muted">Apuestas guardadas</dt><dd className="font-semibold">{bets.length}</dd></div>
            <div><dt className="text-xs text-pitch-muted">Acierto (resueltas)</dt><dd className="font-semibold">{hitRate != null ? `${hitRate.toLocaleString('es-ES')}%` : '—'}</dd></div>
            <div><dt className="text-xs text-pitch-muted">Beneficio simulado</dt><dd className={`font-semibold ${totalProfit > 0 ? 'text-pitch-accent' : totalProfit < 0 ? 'text-pitch-danger' : ''}`}>{resolved.some((b) => b.stake != null) ? `${totalProfit.toLocaleString('es-ES')} €` : '—'}</dd></div>
            <div><dt className="text-xs text-pitch-muted">Cuota media</dt><dd className="font-semibold">{avgOdds?.toLocaleString('es-ES') ?? '—'}</dd></div>
            <div><dt className="text-xs text-pitch-muted">Simples (aciertos)</dt><dd className="font-semibold">{byType('SIMPLE') ?? '—'}</dd></div>
            <div><dt className="text-xs text-pitch-muted">Combinadas (aciertos)</dt><dd className="font-semibold">{byType('COMBINADA') ?? '—'}</dd></div>
          </dl>
          <p className="mt-3 text-[11px] text-pitch-muted">
            {streak > 1 && `Racha actual: ${streak} ganadas seguidas. `}
            {streak < -1 && `Racha actual: ${-streak} perdidas seguidas. `}
            Estas métricas describen tus simulaciones pasadas{decided.length < 10 && ', con una muestra todavía pequeña,'} y no
            demuestran ninguna ventaja predictiva ni garantizan resultados futuros.
          </p>
        </section>
      )}

      {/* Acciones y filtros */}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <button
          type="button"
          onClick={updateResults}
          disabled={updating}
          className="rounded-lg bg-pitch-accent px-4 py-2 font-medium text-black disabled:opacity-40"
        >
          {updating ? 'Consultando resultados…' : 'Actualizar resultados'}
        </button>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-pitch-muted">Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
            <option value="">Todos</option>
            {Object.entries(BET_STATUS_LABELS).map(([value, s]) => (
              <option key={value} value={value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-pitch-muted">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
            <option value="">Todos</option>
            <option value="SIMPLE">Simple</option>
            <option value="COMBINADA">Combinada</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-pitch-muted">Competición</span>
          <select value={liga} onChange={(e) => setLiga(e.target.value)} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
            <option value="">Todas</option>
            {leagues.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      </div>
      {message != null && <p role="status" className="text-xs text-pitch-muted">{message}</p>}

      {/* Historial */}
      <section aria-label="Historial de apuestas simuladas" className="space-y-3">
        {filtered.map((bet) => {
          const status = BET_STATUS_LABELS[bet.status];
          const profit = settledProfit(bet);
          const open = openId === bet.id;
          return (
            <article key={bet.id} className="fs-panel p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                  {status.prefix} {status.label}
                </span>
                <span className="rounded-full bg-pitch-border/60 px-2 py-0.5 text-xs text-pitch-muted">
                  {bet.type === 'SIMPLE' ? 'Simple' : `Combinada (${bet.selections.length})`}
                </span>
                <time dateTime={bet.createdAt} className="text-xs text-pitch-muted">
                  {new Date(bet.createdAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                </time>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{bet.name}</p>
                <p className="text-xs text-pitch-muted">
                  Cuota total {bet.totalOdds.toLocaleString('es-ES')}
                  {bet.stake != null && ` · importe simulado ${bet.stake.toLocaleString('es-ES')} €`}
                  {profit != null && (
                    <span className={profit > 0 ? ' text-pitch-accent' : profit < 0 ? ' text-pitch-danger' : ''}>
                      {' '}· resultado {profit > 0 ? '+' : ''}{profit.toLocaleString('es-ES')} €
                    </span>
                  )}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : bet.id)}
                  aria-expanded={open}
                  className="rounded-lg border border-pitch-border px-3 py-1.5 text-pitch-muted hover:border-pitch-accent hover:text-white"
                >
                  {open ? 'Ocultar detalle' : 'Ver detalle'}
                </button>
                <button
                  type="button"
                  onClick={() => persist(bets.filter((b) => b.id !== bet.id))}
                  className="rounded-lg border border-pitch-border px-3 py-1.5 text-pitch-muted hover:border-pitch-danger hover:text-pitch-danger"
                >
                  Eliminar
                </button>
              </div>
              {open && (
                <ul className="mt-3 space-y-2 border-t border-pitch-border pt-3">
                  {bet.selections.map((s, i) => {
                    const outcome = OUTCOME_LABELS[s.outcome];
                    return (
                      <li key={i} className="text-xs">
                        <span className={`font-medium ${outcome.className}`}>{outcome.prefix} {outcome.label}</span>
                        {' · '}{s.competition} · {s.matchLabel}
                        {' · '}{marketLabel(s.market, s.option)}
                        {' · '}cuota {s.odds.toLocaleString('es-ES')} ({impliedProbability(s.odds).toLocaleString('es-ES')}%)
                        {' · '}
                        <time dateTime={s.kickoffAt}>
                          {new Date(s.kickoffAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                        </time>
                      </li>
                    );
                  })}
                  {bet.notes !== '' && <li className="text-xs text-pitch-muted">Notas: {bet.notes}</li>}
                  {bet.selections.some((s) => s.outcome === 'PENDIENTE') && bet.status !== 'PENDIENTE' && (
                    <li className="text-xs text-pitch-muted">Resultado pendiente de revisión.</li>
                  )}
                </ul>
              )}
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-pitch-border p-8 text-center text-sm text-pitch-muted">
            <p className="font-medium text-white">
              {bets.length === 0 ? 'Todavía no has guardado ninguna simulación.' : 'Ninguna apuesta coincide con los filtros.'}
            </p>
            {bets.length === 0 && (
              <p className="mt-1">
                Crea tu primer cupón en el <Link href="/apuestas" className="text-pitch-accent hover:underline">creador de apuestas</Link>.
              </p>
            )}
          </div>
        )}
      </section>

      {bets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {confirmDeleteAll ? (
            <>
              <span>¿Borrar todo el historial de este navegador?</span>
              <button type="button" onClick={() => { persist([]); setConfirmDeleteAll(false); }} className="rounded-lg border border-pitch-danger px-3 py-1.5 text-pitch-danger">
                Sí, borrar todo
              </button>
              <button type="button" onClick={() => setConfirmDeleteAll(false)} className="rounded-lg border border-pitch-border px-3 py-1.5 text-pitch-muted">
                Cancelar
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDeleteAll(true)} className="rounded-lg border border-pitch-border px-3 py-1.5 text-pitch-muted hover:border-pitch-danger hover:text-pitch-danger">
              Borrar todo el historial
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-pitch-muted">{RESPONSIBLE_NOTICE}</p>
      <p className="text-[11px] text-pitch-muted">
        Se almacena únicamente: nombre, fecha, selecciones, cuotas introducidas, importe simulado,
        notas y estado, en el almacenamiento local de este navegador. No se envía a ningún servidor
        ni se sincroniza entre dispositivos; puedes eliminarlo con los botones de arriba.
      </p>
    </div>
  );
}
