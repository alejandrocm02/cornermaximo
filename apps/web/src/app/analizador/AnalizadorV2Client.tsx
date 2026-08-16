'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Status = 'PENDIENTE' | 'GANADA' | 'PERDIDA' | 'ANULADA';
type Bankroll = { id: string; name: string; initialBalance: number; createdAt: string };
type Entry = { id: string; bankrollId: string; date: string; event: string; competition: string; market: string; category: string; bookmaker: string; tipster: string; odds: number; stake: number; status: Status; isLive: boolean; notes: string; createdAt: string };
type State = { version: 1; bankrolls: Bankroll[]; bets: Entry[]; activeBankrollId: string };

const KEY = 'cornermaximo.analizador.v1';

function validState(value: unknown): value is State {
  if (value == null || typeof value !== 'object') return false;
  const data = value as Partial<State>;
  return data.version === 1 && Array.isArray(data.bankrolls) && Array.isArray(data.bets) && typeof data.activeBankrollId === 'string';
}

function fallback(): State {
  const id = 'bankroll-principal';
  return { version: 1, bankrolls: [{ id, name: 'Bankroll principal', initialBalance: 1000, createdAt: new Date().toISOString() }], bets: [], activeBankrollId: id };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return fallback();
    const parsed = JSON.parse(raw) as unknown;
    return validState(parsed) ? parsed : fallback();
  } catch {
    return fallback();
  }
}

function result(entry: Entry): number {
  if (entry.status === 'GANADA') return entry.stake * (entry.odds - 1);
  if (entry.status === 'PERDIDA') return -entry.stake;
  return 0;
}

function money(value: number): string {
  return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

function percent(value: number): string {
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 2 })}%`;
}

function saveFile(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AnalizadorV2Client() {
  const [state, setState] = useState<State | null>(null);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setState(load()), []);
  useEffect(() => {
    if (state != null) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const active = state?.bankrolls.find((item) => item.id === state.activeBankrollId) ?? null;
  const entries = useMemo(
    () => state?.bets.filter((item) => item.bankrollId === state.activeBankrollId) ?? [],
    [state],
  );

  const metrics = useMemo(() => {
    const decided = entries.filter((entry) => entry.status === 'GANADA' || entry.status === 'PERDIDA');
    const pending = entries.filter((entry) => entry.status === 'PENDIENTE');
    const annulled = entries.filter((entry) => entry.status === 'ANULADA');
    const stake = decided.reduce((sum, entry) => sum + entry.stake, 0);
    const profit = decided.reduce((sum, entry) => sum + result(entry), 0);
    const exposure = pending.reduce((sum, entry) => sum + entry.stake, 0);
    const wins = decided.filter((entry) => entry.status === 'GANADA').length;
    const ordered = [...decided].sort((a, b) => `${a.date}${a.createdAt}`.localeCompare(`${b.date}${b.createdAt}`));
    let balance = active?.initialBalance ?? 0;
    let peak = balance;
    let drawdown = 0;
    for (const entry of ordered) {
      balance += result(entry);
      peak = Math.max(peak, balance);
      drawdown = Math.max(drawdown, peak - balance);
    }
    return {
      profit,
      balance: (active?.initialBalance ?? 0) + profit,
      available: (active?.initialBalance ?? 0) + profit - exposure,
      roi: stake > 0 ? profit / stake * 100 : 0,
      hitRate: decided.length > 0 ? wins / decided.length * 100 : 0,
      stake,
      exposure,
      drawdown,
      pending: pending.length,
      annulled: annulled.length,
    };
  }, [active, entries]);

  const monthly = useMemo(() => {
    const rows = new Map<string, { stake: number; profit: number; count: number }>();
    for (const entry of entries.filter((item) => item.status === 'GANADA' || item.status === 'PERDIDA')) {
      const month = entry.date.slice(0, 7);
      const row = rows.get(month) ?? { stake: 0, profit: 0, count: 0 };
      row.stake += entry.stake;
      row.profit += result(entry);
      row.count += 1;
      rows.set(month, row);
    }
    return [...rows.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [entries]);

  if (state == null || active == null) return <div className="h-64 fs-skeleton" />;
  const current = state;

  async function restore(file: File): Promise<void> {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!validState(parsed)) throw new Error('La copia no tiene un formato válido.');
      setState(parsed);
      setMessage('Copia restaurada correctamente.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo restaurar la copia.');
    }
  }

  return (
    <div className="space-y-6">
      <section className="fs-panel flex flex-wrap items-end justify-between gap-4 p-4">
        <label className="grid min-w-64 gap-1 text-xs text-pitch-muted">
          Bankroll activo
          <select className="fs-input" value={current.activeBankrollId} onChange={(event) => setState({ ...current, activeBankrollId: event.target.value })}>
            {current.bankrolls.map((bankroll) => <option key={bankroll.id} value={bankroll.id}>{bankroll.name}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} className="hidden" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file != null) void restore(file); event.currentTarget.value = ''; }} />
          <button type="button" className="fs-btn-ghost" onClick={() => inputRef.current?.click()}>Restaurar JSON</button>
          <button type="button" className="fs-btn-ghost" onClick={() => saveFile(`cornermaximo-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(current, null, 2))}>Crear copia</button>
        </div>
        {message !== '' && <p className="w-full text-xs text-pitch-accent" aria-live="polite">{message}</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Saldo realizado" value={money(metrics.balance)} note="Inicial + resultados decididos" />
        <Metric label="Saldo disponible" value={money(metrics.available)} note={`Exposición: ${money(metrics.exposure)}`} />
        <Metric label="Beneficio realizado" value={money(metrics.profit)} note={`Stake decidido: ${money(metrics.stake)}`} />
        <Metric label="ROI corregido" value={percent(metrics.roi)} note="Anuladas excluidas" />
        <Metric label="Acierto" value={percent(metrics.hitRate)} note="Ganadas y perdidas" />
        <Metric label="Drawdown máximo" value={money(metrics.drawdown)} note="Sobre saldo realizado" />
        <Metric label="Pendientes" value={String(metrics.pending)} note={money(metrics.exposure)} />
        <Metric label="Anuladas" value={String(metrics.annulled)} note="Sin impacto en ROI" />
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold">Evolución mensual</h3>
        {monthly.length === 0 ? <p className="text-sm text-pitch-muted">Sin operaciones decididas.</p> : (
          <div className="overflow-x-auto rounded-xl border border-pitch-border">
            <table className="w-full min-w-[520px] bg-pitch-card text-sm">
              <thead><tr className="border-b border-pitch-border text-xs uppercase text-pitch-muted"><th className="px-3 py-2 text-left">Mes</th><th className="px-3 py-2 text-right">Ops.</th><th className="px-3 py-2 text-right">Stake</th><th className="px-3 py-2 text-right">Beneficio</th><th className="px-3 py-2 text-right">ROI</th></tr></thead>
              <tbody>{monthly.map(([month, row]) => <tr key={month} className="border-b border-pitch-border/50"><td className="px-3 py-2">{month}</td><td className="px-3 py-2 text-right">{row.count}</td><td className="px-3 py-2 text-right">{money(row.stake)}</td><td className="px-3 py-2 text-right">{money(row.profit)}</td><td className="px-3 py-2 text-right">{percent(row.stake > 0 ? row.profit / row.stake * 100 : 0)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="fs-panel p-4"><p className="text-xs uppercase tracking-wide text-pitch-muted">{label}</p><p className="mt-2 font-display text-2xl font-bold text-white">{value}</p><p className="mt-1 text-2xs text-pitch-muted">{note}</p></article>;
}
