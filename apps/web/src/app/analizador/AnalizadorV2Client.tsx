'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Status = 'PENDIENTE' | 'GANADA' | 'PERDIDA' | 'ANULADA';
type Bankroll = { id: string; name: string; initialBalance: number; createdAt: string };
type Entry = {
  id: string;
  bankrollId: string;
  date: string;
  event: string;
  competition: string;
  market: string;
  category: string;
  bookmaker: string;
  tipster: string;
  odds: number;
  stake: number;
  status: Status;
  isLive: boolean;
  notes: string;
  createdAt: string;
};
type State = { version: 1; bankrolls: Bankroll[]; bets: Entry[]; activeBankrollId: string };

const KEY = 'futstats.analizador.v1';
const DEFAULT_ID = 'bankroll-principal';

function blankState(): State {
  return {
    version: 1,
    bankrolls: [{ id: DEFAULT_ID, name: 'Bankroll principal', initialBalance: 1000, createdAt: new Date().toISOString() }],
    bets: [],
    activeBankrollId: DEFAULT_ID,
  };
}

function validState(value: unknown): value is State {
  if (value == null || typeof value !== 'object') return false;
  const candidate = value as Partial<State>;
  return candidate.version === 1 && Array.isArray(candidate.bankrolls) && Array.isArray(candidate.bets) && typeof candidate.activeBankrollId === 'string';
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return blankState();
    const parsed = JSON.parse(raw) as unknown;
    return validState(parsed) ? parsed : blankState();
  } catch {
    return blankState();
  }
}

function profit(entry: Entry): number {
  if (entry.status === 'GANADA') return entry.stake * (entry.odds - 1);
  if (entry.status === 'PERDIDA') return -entry.stake;
  return 0;
}

function money(value: number): string {
  return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

function pct(value: number): string {
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 2 })}%`;
}

function uid(prefix: string): string {
  return `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string, bankrollId: string): Entry[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index]!;
      if (char === '"' && quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { cells.push(current); current = ''; }
      else current += char;
    }
    cells.push(current);
    return cells;
  };
  const header = parseLine(lines[0]!).map((cell) => cell.trim().toLowerCase());
  const indexOf = (...names: string[]) => names.map((name) => header.indexOf(name)).find((index) => index >= 0) ?? -1;
  const indexes = {
    date: indexOf('fecha'), event: indexOf('evento'), competition: indexOf('competición', 'competicion'),
    market: indexOf('mercado'), category: indexOf('categoría', 'categoria'), bookmaker: indexOf('casa'),
    tipster: indexOf('tipster'), odds: indexOf('cuota'), stake: indexOf('stake'), status: indexOf('estado'),
    live: indexOf('en directo'), notes: indexOf('notas'),
  };
  return lines.slice(1).map(parseLine).map((row): Entry | null => {
    const odds = Number(row[indexes.odds] ?? '');
    const stake = Number(row[indexes.stake] ?? '');
    const rawStatus = (row[indexes.status] ?? '').toUpperCase();
    const status: Status = ['GANADA', 'PERDIDA', 'ANULADA', 'PENDIENTE'].includes(rawStatus) ? rawStatus as Status : 'PENDIENTE';
    if (!Number.isFinite(odds) || odds <= 1 || !Number.isFinite(stake) || stake < 0) return null;
    return {
      id: uid('import'), bankrollId, date: row[indexes.date] || new Date().toISOString().slice(0, 10),
      event: row[indexes.event] || 'Operación importada', competition: row[indexes.competition] || '',
      market: row[indexes.market] || 'Otro', category: row[indexes.category] || '', bookmaker: row[indexes.bookmaker] || '',
      tipster: row[indexes.tipster] || '', odds, stake, status, isLive: /true|sí|si|1/i.test(row[indexes.live] ?? ''),
      notes: row[indexes.notes] || '', createdAt: new Date().toISOString(),
    };
  }).filter((entry): entry is Entry => entry != null);
}

export function AnalizadorV2Client() {
  const [state, setState] = useState<State | null>(null);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'TODAS' | Status>('TODAS');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setState(load()), []);
  useEffect(() => { if (state != null) localStorage.setItem(KEY, JSON.stringify(state)); }, [state]);

  const active = state?.bankrolls.find((item) => item.id === state.activeBankrollId) ?? null;
  const entries = useMemo(() => state?.bets.filter((item) => item.bankrollId === state.activeBankrollId) ?? [], [state]);
  const metrics = useMemo(() => {
    const decided = entries.filter((entry) => entry.status === 'GANADA' || entry.status === 'PERDIDA');
    const annulled = entries.filter((entry) => entry.status === 'ANULADA');
    const pending = entries.filter((entry) => entry.status === 'PENDIENTE');
    const risked = decided.reduce((sum, entry) => sum + entry.stake, 0);
    const realizedProfit = decided.reduce((sum, entry) => sum + profit(entry), 0);
    const won = decided.filter((entry) => entry.status === 'GANADA').length;
    const exposure = pending.reduce((sum, entry) => sum + entry.stake, 0);
    const ordered = [...decided].sort((a, b) => `${a.date}${a.createdAt}`.localeCompare(`${b.date}${b.createdAt}`));
    let balance = active?.initialBalance ?? 0;
    let peak = balance;
    let drawdown = 0;
    for (const entry of ordered) { balance += profit(entry); peak = Math.max(peak, balance); drawdown = Math.max(drawdown, peak - balance); }
    return {
      realizedProfit, realizedBalance: (active?.initialBalance ?? 0) + realizedProfit,
      availableBalance: (active?.initialBalance ?? 0) + realizedProfit - exposure,
      roi: risked > 0 ? realizedProfit / risked * 100 : 0, hitRate: decided.length > 0 ? won / decided.length * 100 : 0,
      risked, exposure, drawdown, decided: decided.length, annulled: annulled.length, pending: pending.length,
    };
  }, [active, entries]);

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; risked: number; profit: number; bets: number }>();
    for (const entry of entries.filter((item) => item.status === 'GANADA' || item.status === 'PERDIDA')) {
      const month = entry.date.slice(0, 7);
      const row = map.get(month) ?? { month, risked: 0, profit: 0, bets: 0 };
      row.risked += entry.stake; row.profit += profit(entry); row.bets += 1; map.set(month, row);
    }
    return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [entries]);

  if (state == null || active == null) return <div className="h-64 fs-skeleton" />;

  const update = (updater: (current: State) => State) => setState((current) => current == null ? current : updater(current));
  const visible = entries.filter((entry) => filter === 'TODAS' || entry.status === filter).sort((a, b) => b.date.localeCompare(a.date));

  async function importFile(file: File): Promise<void> {
    const text = await file.text();
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text) as unknown;
        const candidate = validState(parsed) ? parsed : (typeof parsed === 'object' && parsed != null && validState(parsed as Record<string, unknown>)) ? parsed as State : null;
        if (candidate == null) throw new Error('Formato JSON no reconocido');
        setState(candidate); setMessage('Copia JSON restaurada correctamente.');
      } else {
        const imported = parseCsv(text, state.activeBankrollId);
        if (imported.length === 0) throw new Error('No se encontraron filas válidas');
        update((current) => ({ ...current, bets: [...imported, ...current.bets] }));
        setMessage(`${imported.length} operaciones importadas desde CSV.`);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo importar el archivo.'); }
  }

  return (
    <div className="space-y-8">
      <section className="fs-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="grid min-w-64 gap-1 text-xs text-pitch-muted">
            Bankroll activo
            <select className="fs-input" value={state.activeBankrollId} onChange={(event) => update((current) => ({ ...current, activeBankrollId: event.target.value }))}>
              {state.bankrolls.map((bankroll) => <option key={bankroll.id} value={bankroll.id}>{bankroll.name}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file != null) void importFile(file); event.currentTarget.value = ''; }} />
            <button className="fs-btn-ghost" type="button" onClick={() => fileRef.current?.click()}>Importar / restaurar</button>
            <button className="fs-btn-ghost" type="button" onClick={() => download(`futstats-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(state, null, 2), 'application/json')}>Copia JSON</button>
          </div>
        </div>
        {message !== '' && <p className="mt-3 text-xs text-pitch-accent" aria-live="polite">{message}</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Saldo realizado" value={money(metrics.realizedBalance)} note="Inicial + operaciones decididas" />
        <Metric label="Saldo disponible" value={money(metrics.availableBalance)} note={`Exposición pendiente: ${money(metrics.exposure)}`} />
        <Metric label="Beneficio realizado" value={money(metrics.realizedProfit)} note={`${metrics.decided} operaciones decididas`} />
        <Metric label="ROI corregido" value={pct(metrics.roi)} note={`Stake decidido: ${money(metrics.risked)}`} />
        <Metric label="Acierto" value={pct(metrics.hitRate)} note="Solo ganadas y perdidas" />
        <Metric label="Drawdown máximo" value={money(metrics.drawdown)} note="Sobre saldo realizado" />
        <Metric label="Pendientes" value={String(metrics.pending)} note={money(metrics.exposure)} />
        <Metric label="Anuladas" value={String(metrics.annulled)} note="No afectan al ROI" />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Evolución mensual</h2>
        {monthly.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-pitch-border">
            <table className="w-full min-w-[560px] bg-pitch-card text-sm"><thead><tr className="border-b border-pitch-border text-left text-xs uppercase text-pitch-muted"><th className="px-3 py-2">Mes</th><th className="px-3 py-2 text-right">Operaciones</th><th className="px-3 py-2 text-right">Stake</th><th className="px-3 py-2 text-right">Beneficio</th><th className="px-3 py-2 text-right">ROI</th></tr></thead><tbody>{monthly.map((row) => <tr key={row.month} className="border-b border-pitch-border/50"><td className="px-3 py-2">{row.month}</td><td className="px-3 py-2 text-right">{row.bets}</td><td className="px-3 py-2 text-right">{money(row.risked)}</td><td className={`px-3 py-2 text-right ${row.profit >= 0 ? 'text-pitch-accent' : 'text-pitch-danger'}`}>{money(row.profit)}</td><td className="px-3 py-2 text-right">{pct(row.risked > 0 ? row.profit / row.risked * 100 : 0)}</td></tr>)}</tbody></table>
          </div>
        ) : <p className="text-sm text-pitch-muted">Todavía no hay operaciones decididas para crear el desglose mensual.</p>}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Historial compatible</h2><select className="fs-input w-auto" value={filter} onChange={(event) => setFilter(event.target.value as 'TODAS' | Status)}><option value="TODAS">Todas</option><option value="PENDIENTE">Pendientes</option><option value="GANADA">Ganadas</option><option value="PERDIDA">Perdidas</option><option value="ANULADA">Anuladas</option></select></div>
        <div className="space-y-2">{visible.map((entry) => <article key={entry.id} className="fs-panel flex flex-wrap items-center gap-3 px-4 py-3 text-sm"><div className="min-w-0 flex-1"><p className="truncate font-semibold text-white">{entry.event}</p><p className="text-xs text-pitch-muted">{entry.date} · {entry.market || 'Sin mercado'} · cuota {entry.odds}</p></div><span className="fs-chip">{entry.status}</span><span className={`font-semibold ${profit(entry) >= 0 ? 'text-pitch-accent' : 'text-pitch-danger'}`}>{money(profit(entry))}</span></article>)}</div>
      </section>

      <div className="fs-panel border-pitch-warning/30 bg-pitch-warning/5 p-4 text-xs leading-5 text-pitch-muted">
        Esta versión conserva los datos existentes y corrige el denominador del ROI: las anuladas devuelven el stake y no cuentan como capital arriesgado decidido. Para crear o editar operaciones se mantiene temporalmente la interfaz anterior hasta completar la migración visual.
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="fs-panel p-4"><p className="text-xs uppercase tracking-wide text-pitch-muted">{label}</p><p className="mt-2 font-display text-2xl font-bold text-white">{value}</p><p className="mt-1 text-2xs text-pitch-muted">{note}</p></article>;
}
