'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

type BetStatus = 'PENDIENTE' | 'GANADA' | 'PERDIDA' | 'ANULADA';

interface Bankroll {
  id: string;
  name: string;
  initialBalance: number;
  createdAt: string;
}

interface BetEntry {
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
  status: BetStatus;
  isLive: boolean;
  notes: string;
  createdAt: string;
}

interface AnalyzerState {
  version: 1;
  bankrolls: Bankroll[];
  bets: BetEntry[];
  activeBankrollId: string;
}

interface LegacyBet {
  id?: string;
  name?: string;
  createdAt?: string;
  type?: string;
  stake?: number | null;
  totalOdds?: number;
  status?: string;
  notes?: string;
}

const STORAGE_KEY = 'cornermaximo.analizador.v1';
const LEGACY_STORAGE_KEY = 'cornermaximo.apuestas.v1';
const DEFAULT_BANKROLL_ID = 'bankroll-principal';

const MARKETS = [
  '1X2',
  'Doble oportunidad',
  'Más/Menos goles',
  'Ambos marcan',
  'Hándicap',
  'Goleador',
  'Córners',
  'Tarjetas',
  'Combinada',
  'Otro',
] as const;

const STATUS_META: Record<BetStatus, { label: string; className: string }> = {
  PENDIENTE: { label: 'Pendiente', className: 'border-sky-500/30 bg-sky-500/10 text-sky-300' },
  GANADA: { label: 'Ganada', className: 'border-pitch-accent/30 bg-pitch-accent/10 text-pitch-accent' },
  PERDIDA: { label: 'Perdida', className: 'border-pitch-danger/30 bg-pitch-danger/10 text-pitch-danger' },
  ANULADA: { label: 'Anulada', className: 'border-pitch-border bg-pitch-elevated text-pitch-muted' },
};

function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultState(): AnalyzerState {
  return {
    version: 1,
    bankrolls: [
      {
        id: DEFAULT_BANKROLL_ID,
        name: 'Bankroll principal',
        initialBalance: 1000,
        createdAt: new Date().toISOString(),
      },
    ],
    bets: [],
    activeBankrollId: DEFAULT_BANKROLL_ID,
  };
}

function mapLegacyStatus(status: string | undefined): BetStatus {
  if (status === 'GANADA') return 'GANADA';
  if (status === 'PERDIDA') return 'PERDIDA';
  if (status === 'ANULADA' || status === 'PARCIALMENTE_ANULADA') return 'ANULADA';
  return 'PENDIENTE';
}

function loadState(): AnalyzerState {
  const fallback = defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw) as Partial<AnalyzerState>;
      if (parsed.version === 1 && Array.isArray(parsed.bankrolls) && Array.isArray(parsed.bets)) {
        const active = parsed.bankrolls.some((bankroll) => bankroll.id === parsed.activeBankrollId)
          ? parsed.activeBankrollId!
          : parsed.bankrolls[0]?.id;
        if (active != null) {
          return {
            version: 1,
            bankrolls: parsed.bankrolls,
            bets: parsed.bets,
            activeBankrollId: active,
          };
        }
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw == null) return fallback;
    const legacy = JSON.parse(legacyRaw) as LegacyBet[];
    if (!Array.isArray(legacy) || legacy.length === 0) return fallback;

    const migrated = legacy.map<BetEntry>((bet, index) => ({
      id: `legacy-${bet.id ?? index}`,
      bankrollId: DEFAULT_BANKROLL_ID,
      date: (bet.createdAt ?? new Date().toISOString()).slice(0, 10),
      event: bet.name?.trim() || 'Operación migrada',
      competition: '',
      market: bet.type === 'COMBINADA' ? 'Combinada' : 'Otro',
      category: 'Migrada desde Apuestas',
      bookmaker: '',
      tipster: '',
      odds: typeof bet.totalOdds === 'number' && Number.isFinite(bet.totalOdds) && bet.totalOdds > 1 ? bet.totalOdds : 2,
      stake: typeof bet.stake === 'number' && Number.isFinite(bet.stake) && bet.stake > 0 ? bet.stake : 0,
      status: mapLegacyStatus(bet.status),
      isLive: false,
      notes: bet.notes ?? '',
      createdAt: bet.createdAt ?? new Date().toISOString(),
    }));

    return { ...fallback, bets: migrated };
  } catch {
    return fallback;
  }
}

function profitOf(bet: BetEntry): number {
  if (bet.status === 'GANADA') return bet.stake * (bet.odds - 1);
  if (bet.status === 'PERDIDA') return -bet.stake;
  return 0;
}

function isSettled(bet: BetEntry): boolean {
  return bet.status !== 'PENDIENTE';
}

function formatMoney(value: number): string {
  return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('es-ES', { maximumFractionDigits: digits });
}

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadFile(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AnalizadorClient() {
  const [state, setState] = useState<AnalyzerState | null>(null);
  const [showBankrollForm, setShowBankrollForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'TODAS' | BetStatus>('TODAS');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    if (state == null) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const activeBankroll = state?.bankrolls.find((bankroll) => bankroll.id === state.activeBankrollId) ?? null;
  const activeBets = useMemo(
    () => state?.bets.filter((bet) => bet.bankrollId === state.activeBankrollId) ?? [],
    [state],
  );

  const metrics = useMemo(() => {
    const initial = activeBankroll?.initialBalance ?? 0;
    const settled = activeBets.filter(isSettled);
    const decided = activeBets.filter((bet) => bet.status === 'GANADA' || bet.status === 'PERDIDA');
    const totalStake = settled.reduce((sum, bet) => sum + bet.stake, 0);
    const profit = settled.reduce((sum, bet) => sum + profitOf(bet), 0);
    const won = decided.filter((bet) => bet.status === 'GANADA').length;
    const pendingExposure = activeBets
      .filter((bet) => bet.status === 'PENDIENTE')
      .reduce((sum, bet) => sum + bet.stake, 0);
    const avgOdds = activeBets.length > 0
      ? activeBets.reduce((sum, bet) => sum + bet.odds, 0) / activeBets.length
      : 0;

    const ordered = [...settled].sort((a, b) => `${a.date}${a.createdAt}`.localeCompare(`${b.date}${b.createdAt}`));
    let balance = initial;
    let peak = initial;
    let maxDrawdown = 0;
    const evolution = [{ label: 'Inicio', balance }];
    for (const bet of ordered) {
      balance += profitOf(bet);
      peak = Math.max(peak, balance);
      maxDrawdown = Math.max(maxDrawdown, peak - balance);
      evolution.push({ label: bet.date, balance });
    }

    return {
      balance: initial + profit,
      profit,
      roi: totalStake > 0 ? (profit / totalStake) * 100 : 0,
      hitRate: decided.length > 0 ? (won / decided.length) * 100 : 0,
      totalStake,
      pendingExposure,
      avgOdds,
      maxDrawdown,
      settledCount: settled.length,
      evolution,
    };
  }, [activeBankroll, activeBets]);

  const breakdown = useMemo(() => {
    const map = new Map<string, { market: string; bets: number; stake: number; profit: number; wins: number; losses: number }>();
    for (const bet of activeBets.filter(isSettled)) {
      const market = bet.market || 'Sin mercado';
      const current = map.get(market) ?? { market, bets: 0, stake: 0, profit: 0, wins: 0, losses: 0 };
      current.bets += 1;
      current.stake += bet.stake;
      current.profit += profitOf(bet);
      if (bet.status === 'GANADA') current.wins += 1;
      if (bet.status === 'PERDIDA') current.losses += 1;
      map.set(market, current);
    }
    return [...map.values()].sort((a, b) => b.bets - a.bets || b.profit - a.profit);
  }, [activeBets]);

  const visibleBets = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return [...activeBets]
      .filter((bet) => filterStatus === 'TODAS' || bet.status === filterStatus)
      .filter((bet) => {
        if (normalized === '') return true;
        return [bet.event, bet.competition, bet.market, bet.category, bet.bookmaker, bet.tipster]
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      })
      .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  }, [activeBets, filterStatus, search]);

  if (state == null || activeBankroll == null) {
    return (
      <div className="space-y-3" aria-live="polite">
        <div className="h-28 fs-skeleton" />
        <div className="h-64 fs-skeleton" />
      </div>
    );
  }

  const currentState = state;

  function updateState(updater: (current: AnalyzerState) => AnalyzerState): void {
    setState((current) => (current == null ? current : updater(current)));
  }

  function setActiveBankroll(id: string): void {
    updateState((current) => ({ ...current, activeBankrollId: id }));
  }

  function addBankroll(name: string, initialBalance: number): void {
    const bankroll: Bankroll = {
      id: uid('bankroll'),
      name,
      initialBalance,
      createdAt: new Date().toISOString(),
    };
    updateState((current) => ({
      ...current,
      bankrolls: [...current.bankrolls, bankroll],
      activeBankrollId: bankroll.id,
    }));
    setShowBankrollForm(false);
  }

  function addBet(bet: Omit<BetEntry, 'id' | 'bankrollId' | 'createdAt'>): void {
    const entry: BetEntry = {
      ...bet,
      id: uid('bet'),
      bankrollId: currentState.activeBankrollId,
      createdAt: new Date().toISOString(),
    };
    updateState((current) => ({ ...current, bets: [entry, ...current.bets] }));
  }

  function updateBetStatus(id: string, status: BetStatus): void {
    updateState((current) => ({
      ...current,
      bets: current.bets.map((bet) => (bet.id === id ? { ...bet, status } : bet)),
    }));
  }

  function deleteBet(id: string): void {
    updateState((current) => ({ ...current, bets: current.bets.filter((bet) => bet.id !== id) }));
  }

  function exportJson(): void {
    downloadFile(
      `cornermaximo-analizador-${today()}.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), ...currentState }, null, 2),
      'application/json',
    );
  }

  function exportCsv(): void {
    const header = [
      'Bankroll', 'Fecha', 'Evento', 'Competición', 'Mercado', 'Categoría', 'Casa', 'Tipster',
      'Cuota', 'Stake', 'Estado', 'Beneficio', 'En directo', 'Notas',
    ];
    const rows = currentState.bets.map((bet) => {
      const bankroll = currentState.bankrolls.find((item) => item.id === bet.bankrollId)?.name ?? '';
      return [
        bankroll, bet.date, bet.event, bet.competition, bet.market, bet.category, bet.bookmaker,
        bet.tipster, bet.odds, bet.stake, bet.status, profitOf(bet), bet.isLive, bet.notes,
      ].map(csvCell).join(',');
    });
    downloadFile(
      `cornermaximo-analizador-${today()}.csv`,
      `\uFEFF${[header.map(csvCell).join(','), ...rows].join('\n')}`,
      'text/csv;charset=utf-8',
    );
  }

  return (
    <div className="space-y-8">
      <section className="fs-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-pitch-muted">Bankroll activo</span>
            <select
              value={currentState.activeBankrollId}
              onChange={(event) => setActiveBankroll(event.target.value)}
              className="fs-input max-w-md"
            >
              {currentState.bankrolls.map((bankroll) => (
                <option key={bankroll.id} value={bankroll.id}>
                  {bankroll.name} · inicial {formatMoney(bankroll.initialBalance)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowBankrollForm((open) => !open)} className="fs-btn-ghost px-4 py-2.5">
              + Nuevo bankroll
            </button>
            <button type="button" onClick={exportCsv} className="fs-btn-ghost px-4 py-2.5">Exportar CSV</button>
            <button type="button" onClick={exportJson} className="fs-btn-ghost px-4 py-2.5">Copia JSON</button>
          </div>
        </div>
        {showBankrollForm && <BankrollForm onCreate={addBankroll} onCancel={() => setShowBankrollForm(false)} />}
      </section>

      <section aria-label="Resumen del bankroll" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metric label="Balance actual" value={formatMoney(metrics.balance)} tone={metrics.profit >= 0 ? 'positive' : 'negative'} />
        <Metric label="Beneficio neto" value={formatMoney(metrics.profit)} tone={metrics.profit >= 0 ? 'positive' : 'negative'} />
        <Metric label="ROI" value={`${formatNumber(metrics.roi)} %`} tone={metrics.roi >= 0 ? 'positive' : 'negative'} />
        <Metric label="Acierto" value={`${formatNumber(metrics.hitRate, 1)} %`} />
        <Metric label="Stake liquidado" value={formatMoney(metrics.totalStake)} />
        <Metric label="Exposición" value={formatMoney(metrics.pendingExposure)} />
        <Metric label="Cuota media" value={metrics.avgOdds > 0 ? formatNumber(metrics.avgOdds) : '—'} />
        <Metric label="Drawdown máx." value={formatMoney(metrics.maxDrawdown)} tone={metrics.maxDrawdown > 0 ? 'negative' : undefined} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
        <div className="fs-panel p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="fs-eyebrow">Evolución</p>
              <h2 className="mt-1 text-xl font-bold">Curva de balance</h2>
            </div>
            <span className="text-xs text-pitch-muted">{metrics.settledCount} operaciones liquidadas</span>
          </div>
          <BalanceChart points={metrics.evolution} />
        </div>

        <div className="fs-panel p-4 sm:p-5">
          <p className="fs-eyebrow">Rendimiento</p>
          <h2 className="mt-1 text-xl font-bold">Por mercado</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="border-b border-pitch-border text-left text-2xs uppercase tracking-wide text-pitch-muted">
                <tr>
                  <th className="py-2 pr-3">Mercado</th>
                  <th className="px-2 py-2 text-right">Ops.</th>
                  <th className="px-2 py-2 text-right">Acierto</th>
                  <th className="py-2 pl-2 text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.slice(0, 8).map((row) => {
                  const decided = row.wins + row.losses;
                  const hitRate = decided > 0 ? (row.wins / decided) * 100 : 0;
                  const roi = row.stake > 0 ? (row.profit / row.stake) * 100 : 0;
                  return (
                    <tr key={row.market} className="border-b border-pitch-border/50 last:border-0">
                      <th scope="row" className="py-2 pr-3 text-left font-medium">{row.market}</th>
                      <td className="px-2 py-2 text-right text-pitch-muted">{row.bets}</td>
                      <td className="px-2 py-2 text-right text-pitch-muted">{formatNumber(hitRate, 1)} %</td>
                      <td className={`py-2 pl-2 text-right font-semibold ${roi >= 0 ? 'text-pitch-accent' : 'text-pitch-danger'}`}>
                        {formatNumber(roi)} %
                      </td>
                    </tr>
                  );
                })}
                {breakdown.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-pitch-muted">
                      Liquida operaciones para ver el análisis por mercado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <p className="fs-eyebrow">Registro</p>
          <h2 className="mt-1 text-2xl font-bold">Añadir operación</h2>
        </div>
        <BetForm onCreate={addBet} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="fs-eyebrow">Historial</p>
            <h2 className="mt-1 text-2xl font-bold">Operaciones registradas</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <label className="flex flex-col gap-1 text-xs text-pitch-muted">
              Estado
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value as 'TODAS' | BetStatus)}
                className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 text-sm text-white"
              >
                <option value="TODAS">Todas</option>
                {(Object.keys(STATUS_META) as BetStatus[]).map((status) => (
                  <option key={status} value={status}>{STATUS_META[status].label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-pitch-muted">
              Buscar
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="evento, liga, mercado…"
                className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 text-sm text-white placeholder:text-pitch-muted"
              />
            </label>
          </div>
        </div>

        <div className="fs-panel overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <caption className="sr-only">Historial de operaciones del bankroll {activeBankroll.name}</caption>
            <thead className="border-b border-pitch-border bg-pitch-elevated/40 text-left text-2xs uppercase tracking-[0.12em] text-pitch-muted">
              <tr>
                <th className="px-4 py-3">Fecha y evento</th>
                <th className="px-3 py-3">Mercado</th>
                <th className="px-3 py-3 text-right">Cuota</th>
                <th className="px-3 py-3 text-right">Stake</th>
                <th className="px-3 py-3 text-right">P/L</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-4 py-3 text-right"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleBets.map((bet) => {
                const profit = profitOf(bet);
                return (
                  <tr key={bet.id} className="border-b border-pitch-border/50 align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{bet.event}</p>
                      <p className="mt-0.5 text-xs text-pitch-muted">
                        {new Date(`${bet.date}T12:00:00`).toLocaleDateString('es-ES')}
                        {bet.competition !== '' && ` · ${bet.competition}`}
                        {bet.isLive && ' · En directo'}
                      </p>
                      {(bet.bookmaker !== '' || bet.tipster !== '' || bet.category !== '') && (
                        <p className="mt-1 text-2xs text-pitch-muted">
                          {[bet.bookmaker, bet.tipster, bet.category].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-pitch-subtle">{bet.market}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(bet.odds)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatMoney(bet.stake)}</td>
                    <td className={`px-3 py-3 text-right font-semibold tabular-nums ${profit > 0 ? 'text-pitch-accent' : profit < 0 ? 'text-pitch-danger' : 'text-pitch-muted'}`}>
                      {bet.status === 'PENDIENTE' ? '—' : formatMoney(profit)}
                    </td>
                    <td className="px-3 py-3">
                      <select
                        aria-label={`Estado de ${bet.event}`}
                        value={bet.status}
                        onChange={(event) => updateBetStatus(bet.id, event.target.value as BetStatus)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium outline-none ${STATUS_META[bet.status].className}`}
                      >
                        {(Object.keys(STATUS_META) as BetStatus[]).map((status) => (
                          <option key={status} value={status} className="bg-pitch-card text-white">
                            {STATUS_META[status].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => deleteBet(bet.id)}
                        className="rounded-lg border border-pitch-border px-3 py-1.5 text-xs text-pitch-muted hover:border-pitch-danger/60 hover:text-pitch-danger"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibleBets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-pitch-muted">
                    No hay operaciones que coincidan con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-pitch-muted">
        Los datos se guardan en <code>localStorage</code>. Exporta una copia regularmente: al borrar los
        datos del navegador también se eliminará este historial.
      </p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="fs-panel min-w-0 p-3 sm:p-4">
      <p className={`truncate font-display text-lg font-bold tabular-nums sm:text-xl ${tone === 'positive' ? 'text-pitch-accent' : tone === 'negative' ? 'text-pitch-danger' : 'text-white'}`}>
        {value}
      </p>
      <p className="mt-1 text-2xs uppercase tracking-wide text-pitch-muted">{label}</p>
    </div>
  );
}

function BankrollForm({ onCreate, onCancel }: { onCreate: (name: string, balance: number) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('1000');
  const validBalance = Number(balance);

  return (
    <form
      className="mt-4 grid gap-3 border-t border-pitch-border pt-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() === '' || !Number.isFinite(validBalance) || validBalance < 0) return;
        onCreate(name.trim(), validBalance);
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-pitch-muted">
        Nombre
        <input value={name} onChange={(event) => setName(event.target.value)} className="fs-input" placeholder="Ej. Bankroll conservador" required />
      </label>
      <label className="flex flex-col gap-1 text-xs text-pitch-muted">
        Capital inicial
        <input type="number" min="0" step="0.01" value={balance} onChange={(event) => setBalance(event.target.value)} className="fs-input" required />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="fs-btn-primary flex-1 px-4 py-3">Crear</button>
        <button type="button" onClick={onCancel} className="fs-btn-ghost px-4 py-3">Cancelar</button>
      </div>
    </form>
  );
}

function BetForm({ onCreate }: { onCreate: (bet: Omit<BetEntry, 'id' | 'bankrollId' | 'createdAt'>) => void }) {
  const [date, setDate] = useState(today());
  const [eventName, setEventName] = useState('');
  const [competition, setCompetition] = useState('');
  const [market, setMarket] = useState<(typeof MARKETS)[number]>('1X2');
  const [odds, setOdds] = useState('2.00');
  const [stake, setStake] = useState('10');
  const [status, setStatus] = useState<BetStatus>('PENDIENTE');
  const [category, setCategory] = useState('');
  const [bookmaker, setBookmaker] = useState('');
  const [tipster, setTipster] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [notes, setNotes] = useState('');

  const numericOdds = Number(odds);
  const numericStake = Number(stake);
  const potentialProfit = Number.isFinite(numericOdds) && Number.isFinite(numericStake)
    ? numericStake * Math.max(0, numericOdds - 1)
    : 0;

  return (
    <form
      className="fs-panel grid gap-4 p-4 sm:p-5 lg:grid-cols-12"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        if (eventName.trim() === '' || numericOdds <= 1 || numericStake <= 0) return;
        onCreate({
          date,
          event: eventName.trim(),
          competition: competition.trim(),
          market,
          category: category.trim(),
          bookmaker: bookmaker.trim(),
          tipster: tipster.trim(),
          odds: numericOdds,
          stake: numericStake,
          status,
          isLive,
          notes: notes.trim(),
        });
        setEventName('');
        setNotes('');
        setStatus('PENDIENTE');
        setIsLive(false);
      }}
    >
      <Field label="Fecha" className="lg:col-span-2">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="fs-input" required />
      </Field>
      <Field label="Partido o selección" className="lg:col-span-4">
        <input value={eventName} onChange={(event) => setEventName(event.target.value)} className="fs-input" placeholder="Ej. Real Madrid - Barcelona" required />
      </Field>
      <Field label="Competición" className="lg:col-span-3">
        <input value={competition} onChange={(event) => setCompetition(event.target.value)} className="fs-input" placeholder="Ej. LaLiga" />
      </Field>
      <Field label="Mercado" className="lg:col-span-3">
        <select value={market} onChange={(event) => setMarket(event.target.value as (typeof MARKETS)[number])} className="fs-input">
          {MARKETS.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </Field>

      <Field label="Cuota decimal" className="lg:col-span-2">
        <input type="number" min="1.01" step="0.01" value={odds} onChange={(event) => setOdds(event.target.value)} className="fs-input" required />
      </Field>
      <Field label="Stake" className="lg:col-span-2">
        <input type="number" min="0.01" step="0.01" value={stake} onChange={(event) => setStake(event.target.value)} className="fs-input" required />
      </Field>
      <Field label="Estado" className="lg:col-span-3">
        <select value={status} onChange={(event) => setStatus(event.target.value as BetStatus)} className="fs-input">
          {(Object.keys(STATUS_META) as BetStatus[]).map((value) => (
            <option key={value} value={value}>{STATUS_META[value].label}</option>
          ))}
        </select>
      </Field>
      <div className="flex items-end lg:col-span-3">
        <label className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-pitch-border bg-pitch-card/80 px-4 py-3 text-sm text-pitch-subtle">
          <input type="checkbox" checked={isLive} onChange={(event) => setIsLive(event.target.checked)} className="h-4 w-4 accent-pitch-accent" />
          Operación en directo
        </label>
      </div>
      <div className="flex items-end lg:col-span-2">
        <p className="w-full rounded-xl border border-pitch-border bg-pitch-elevated/50 px-4 py-3 text-xs text-pitch-muted">
          Beneficio potencial<br />
          <span className="font-display text-base font-bold text-pitch-accent">{formatMoney(potentialProfit)}</span>
        </p>
      </div>

      <details className="lg:col-span-12 rounded-xl border border-pitch-border bg-pitch-bg/30 p-4">
        <summary className="cursor-pointer text-sm font-medium text-pitch-subtle">Detalles opcionales</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Casa o plataforma">
            <input value={bookmaker} onChange={(event) => setBookmaker(event.target.value)} className="fs-input" placeholder="Nombre opcional" />
          </Field>
          <Field label="Tipster o fuente">
            <input value={tipster} onChange={(event) => setTipster(event.target.value)} className="fs-input" placeholder="Nombre opcional" />
          </Field>
          <Field label="Categoría o estrategia">
            <input value={category} onChange={(event) => setCategory(event.target.value)} className="fs-input" placeholder="Ej. Value, conservadora…" />
          </Field>
          <Field label="Notas" className="md:col-span-3">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="fs-input min-h-24 resize-y" placeholder="Motivo, análisis previo o contexto" />
          </Field>
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-12">
        <p className="text-xs text-pitch-muted">Registra también las pérdidas: una muestra completa hace que el análisis sea útil.</p>
        <button type="submit" className="fs-btn-primary min-w-44">Guardar operación</button>
      </div>
    </form>
  );
}

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 text-xs text-pitch-muted ${className}`}>
      {label}
      {children}
    </label>
  );
}

function BalanceChart({ points }: { points: Array<{ label: string; balance: number }> }) {
  const width = 760;
  const height = 220;
  const padding = 28;
  const values = points.map((point) => point.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const coords = points.map((point, index) => {
    const x = padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.balance - min) / range) * (height - padding * 2);
    return { ...point, x, y };
  });
  const polyline = coords.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución del balance del bankroll" className="h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="balance-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--pitch-accent))" stopOpacity="0.24" />
            <stop offset="100%" stopColor="rgb(var(--pitch-accent))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((line) => {
          const y = padding + (line / 4) * (height - padding * 2);
          return <line key={line} x1={padding} x2={width - padding} y1={y} y2={y} stroke="rgb(var(--pitch-border))" strokeWidth="1" />;
        })}
        {coords.length > 1 && (
          <polygon points={`${padding},${height - padding} ${polyline} ${width - padding},${height - padding}`} fill="url(#balance-fill)" />
        )}
        <polyline points={polyline} fill="none" stroke="rgb(var(--pitch-accent))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point, index) => (
          <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r={index === coords.length - 1 ? 5 : 3} fill="rgb(var(--pitch-bg))" stroke="rgb(var(--pitch-accent))" strokeWidth="2">
            <title>{point.label}: {formatMoney(point.balance)}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between text-2xs text-pitch-muted">
        <span>{formatMoney(min)}</span>
        <span>{points.length <= 1 ? 'Añade y liquida operaciones para generar la curva' : `${points.length - 1} movimientos`}</span>
        <span>{formatMoney(max)}</span>
      </div>
    </div>
  );
}
