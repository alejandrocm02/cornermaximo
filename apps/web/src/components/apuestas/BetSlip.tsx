'use client';

/**
 * Cupón de apuesta simulada: selecciones, cuotas manuales, cálculos en vivo,
 * conflictos, riesgo y guardado local. No ejecuta apuestas reales.
 */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  BET_MARKETS,
  combinedOdds,
  findConflicts,
  impliedProbability,
  potentialProfit,
  potentialReturn,
  RISK_LABELS,
  riskLevel,
  validateOdds,
  type BetMarketId,
} from '@cornermaximo/stats';
import { useBetSlip } from './BetSlipContext';
import { BETS_KEY, loadJson, RESPONSIBLE_NOTICE, saveJson, type SavedBet } from './betTypes';

const QUICK_STAKES = [5, 10, 20, 50];

function marketLabel(market: BetMarketId, option: string): string {
  const m = BET_MARKETS[market];
  const options = m.options as Record<string, string>;
  return `${m.label}: ${options[option] ?? option}`;
}

export function BetSlip() {
  const slip = useBetSlip();
  const [oddsDrafts, setOddsDrafts] = useState<Record<string, string>>({});
  const [stakeDraft, setStakeDraft] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const key = (matchId: number, market: string, option: string) => `${matchId}|${market}|${option}`;

  const oddsState = slip.selections.map((s) => {
    const draft = oddsDrafts[key(s.matchId, s.market, s.option)];
    const raw = draft ?? (s.odds > 1 ? String(s.odds).replace('.', ',') : '');
    return { selection: s, raw, ...validateOdds(raw) };
  });

  const allOddsValid = oddsState.length > 0 && oddsState.every((o) => o.error == null && o.value != null);
  const totalOdds = allOddsValid ? combinedOdds(oddsState.map((o) => o.value!)) : 0;
  const conflicts = useMemo(() => findConflicts(slip.selections), [slip.selections]);
  const blocking = conflicts.filter((c) => c.blocking);

  const stakeNormalized = stakeDraft.trim().replace(',', '.');
  const stake = stakeNormalized === '' ? null : Number(stakeNormalized);
  const stakeError =
    stake != null && (!Number.isFinite(stake) || stake <= 0 || !/^\d+(\.\d{1,2})?$/.test(stakeNormalized))
      ? 'Introduce un importe positivo, p. ej. 10.'
      : null;

  const risk = riskLevel(totalOdds, slip.selections.length);
  const type: SavedBet['type'] = slip.selections.length > 1 ? 'COMBINADA' : 'SIMPLE';

  function save() {
    if (slip.selections.length === 0 || !allOddsValid || blocking.length > 0 || stakeError != null) return;
    const bet: SavedBet = {
      id: `bet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim() !== '' ? name.trim() : `${type === 'SIMPLE' ? 'Simple' : 'Combinada'} · ${new Date().toLocaleDateString('es-ES')}`,
      createdAt: new Date().toISOString(),
      type,
      selections: oddsState.map((o) => ({ ...o.selection, odds: o.value!, outcome: 'PENDIENTE' as const })),
      stake: stake != null && stakeError == null ? Math.round(stake * 100) / 100 : null,
      totalOdds,
      status: 'PENDIENTE',
      notes: notes.trim(),
    };
    const bets = loadJson<SavedBet[]>(BETS_KEY, []);
    saveJson(BETS_KEY, [bet, ...bets]);
    slip.clear();
    setOddsDrafts({});
    setStakeDraft('');
    setName('');
    setNotes('');
    setSavedMessage('Simulación guardada en este navegador.');
  }

  if (!slip.hydrated) {
    return (
      <div className="space-y-3 fs-panel p-4" aria-hidden="true">
        <div className="h-4 w-2/3 animate-pulse rounded bg-pitch-border/60" />
        <div className="h-10 animate-pulse rounded bg-pitch-border/40" />
        <div className="h-10 animate-pulse rounded bg-pitch-border/40" />
      </div>
    );
  }

  return (
    <section aria-label="Cupón de apuesta simulada" className="space-y-4 fs-panel p-4 text-sm">
      <h2 className="text-base font-bold">Tu cupón</h2>

      {savedMessage != null && slip.selections.length === 0 && (
        <p role="status" className="rounded-lg bg-pitch-accent/10 p-3 text-pitch-accent">
          {savedMessage}{' '}
          <Link href="/apuestas/mis-apuestas" className="underline">Ver mis apuestas</Link>
        </p>
      )}

      {slip.selections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-pitch-border p-6 text-center text-pitch-muted">
          <p className="font-medium text-white">Aún no has añadido ninguna selección.</p>
          <p className="mt-1 text-xs">Explora los próximos partidos y añade pronósticos para construir tu cupón.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {oddsState.map(({ selection: s, raw, error }) => {
              const k = key(s.matchId, s.market, s.option);
              const prob = error == null && raw !== '' ? impliedProbability(validateOdds(raw).value ?? 0) : null;
              const inConflict = blocking.some((c) => c.matchId === s.matchId);
              return (
                <li key={k} className={`rounded-lg border p-3 ${inConflict ? 'border-pitch-danger/60' : 'border-pitch-border'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-pitch-muted">
                        {s.competition} ·{' '}
                        <time dateTime={s.kickoffAt}>
                          {new Date(s.kickoffAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                        </time>
                      </p>
                      <p className="font-semibold">{s.matchLabel}</p>
                      <p className="text-xs text-pitch-muted">{marketLabel(s.market, s.option)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => slip.remove(s.matchId, s.market, s.option)}
                      className="rounded-md px-2 py-1 text-xs text-pitch-muted hover:text-pitch-danger focus-visible:ring-2 focus-visible:ring-pitch-accent"
                      aria-label={`Eliminar selección ${s.matchLabel}, ${marketLabel(s.market, s.option)}`}
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2">
                      <span className="text-xs text-pitch-muted">Cuota</span>
                      <input
                        inputMode="decimal"
                        value={raw}
                        onChange={(e) => {
                          setOddsDrafts((d) => ({ ...d, [k]: e.target.value }));
                          const parsed = validateOdds(e.target.value);
                          if (parsed.value != null) slip.setOdds(s.matchId, s.market, s.option, parsed.value);
                        }}
                        aria-invalid={error != null}
                        aria-describedby={`odds-err-${k}`}
                        placeholder="1,85"
                        className="w-20 rounded-lg border border-pitch-border bg-pitch-bg px-2 py-1.5 outline-none focus:border-pitch-accent focus:ring-2 focus:ring-pitch-accent/40"
                      />
                    </label>
                    {prob != null && (
                      <span className="text-xs text-pitch-muted">Prob. implícita: {prob.toLocaleString('es-ES')}%</span>
                    )}
                    <span className="rounded-full bg-pitch-border/60 px-2 py-0.5 text-[11px] text-pitch-muted">
                      Cuota introducida por el usuario
                    </span>
                  </div>
                  <p id={`odds-err-${k}`} className="mt-1 text-xs text-pitch-danger">{error ?? ''}</p>
                </li>
              );
            })}
          </ul>

          {conflicts.length > 0 && (
            <div role="alert" className="space-y-2">
              {conflicts.map((c) => (
                <p
                  key={c.matchId}
                  className={`rounded-lg p-3 text-xs ${c.blocking ? 'bg-pitch-danger/10 text-pitch-danger' : 'bg-yellow-500/10 text-yellow-300'}`}
                >
                  {c.blocking ? '✕ ' : '⚠ '}
                  {c.reason}
                  {c.blocking && ' Elimina una de las selecciones para poder guardar.'}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-pitch-muted">Importe simulado (opcional, €)</span>
              <input
                inputMode="decimal"
                value={stakeDraft}
                onChange={(e) => setStakeDraft(e.target.value)}
                aria-invalid={stakeError != null}
                aria-describedby="stake-err stake-help"
                placeholder="0"
                className="w-28 rounded-lg border border-pitch-border bg-pitch-bg px-2 py-1.5 outline-none focus:border-pitch-accent focus:ring-2 focus:ring-pitch-accent/40"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_STAKES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setStakeDraft(String(q))}
                  className="rounded-full border border-pitch-border px-3 py-1 text-xs text-pitch-muted hover:border-pitch-accent hover:text-white"
                >
                  {q} €
                </button>
              ))}
            </div>
            <p id="stake-err" className="text-xs text-pitch-danger">{stakeError ?? ''}</p>
            <p id="stake-help" className="text-[11px] text-pitch-muted">
              Este importe se utiliza únicamente para calcular un retorno hipotético.
            </p>
          </div>

          <dl aria-live="polite" className="space-y-1 rounded-lg bg-pitch-bg p-3">
            <div className="flex justify-between">
              <dt className="text-pitch-muted">Tipo</dt>
              <dd className="font-medium">{type === 'SIMPLE' ? 'Apuesta simple' : `Combinada (${slip.selections.length})`}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-pitch-muted">Cuota total</dt>
              <dd className="font-semibold">{allOddsValid ? totalOdds.toLocaleString('es-ES') : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-pitch-muted">Prob. implícita combinada</dt>
              <dd>{allOddsValid && totalOdds > 1 ? `${impliedProbability(totalOdds).toLocaleString('es-ES')}%` : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-pitch-muted">Retorno potencial</dt>
              <dd className="font-semibold">
                {allOddsValid && stake != null && stakeError == null
                  ? `${potentialReturn(stake, totalOdds).toLocaleString('es-ES')} €`
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-pitch-muted">Beneficio potencial</dt>
              <dd>
                {allOddsValid && stake != null && stakeError == null
                  ? `${potentialProfit(stake, totalOdds).toLocaleString('es-ES')} €`
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-pitch-muted">Nivel de riesgo</dt>
              <dd
                className={
                  risk === 'MUY_ALTO' || risk === 'ALTO' ? 'text-pitch-danger' : risk === 'MEDIO' ? 'text-yellow-300' : 'text-pitch-accent'
                }
              >
                {RISK_LABELS[risk]}
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-pitch-muted">El nivel de riesgo es orientativo y no representa una predicción de éxito.</p>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-pitch-muted">Nombre (opcional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="rounded-lg border border-pitch-border bg-pitch-bg px-2 py-1.5 outline-none focus:border-pitch-accent focus:ring-2 focus:ring-pitch-accent/40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-pitch-muted">Notas (opcional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={280}
              rows={2}
              className="rounded-lg border border-pitch-border bg-pitch-bg px-2 py-1.5 outline-none focus:border-pitch-accent focus:ring-2 focus:ring-pitch-accent/40"
            />
          </label>

          <p className="rounded-lg bg-pitch-border/30 p-3 text-[11px] text-pitch-muted">{RESPONSIBLE_NOTICE}</p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!allOddsValid || blocking.length > 0 || stakeError != null}
              className="rounded-lg bg-pitch-accent px-4 py-2 font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Guardar simulación
            </button>
            {confirmClear ? (
              <span className="flex items-center gap-2 text-xs">
                ¿Vaciar el cupón?
                <button type="button" onClick={() => { slip.clear(); setOddsDrafts({}); setConfirmClear(false); }} className="rounded-lg border border-pitch-danger px-3 py-1.5 text-pitch-danger">
                  Sí, vaciar
                </button>
                <button type="button" onClick={() => setConfirmClear(false)} className="rounded-lg border border-pitch-border px-3 py-1.5 text-pitch-muted">
                  Cancelar
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)} className="rounded-lg border border-pitch-border px-4 py-2 text-pitch-muted hover:text-white">
                Limpiar cupón
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
