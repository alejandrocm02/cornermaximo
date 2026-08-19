'use client';

/**
 * Comparador de jugadores.
 * - URL compartible: /comparador?p1=slug&p2=slug&periodo=5|10|temporada
 * - Comparación automática al tener ambos jugadores, intercambio y limpieza.
 * - Muestra total, por partido y por 90' cuando la métrica lo permite.
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SearchBox } from '@/components/SearchBox';
import { useSyncedAccountState } from '@/lib/useSyncedAccountState';

interface Selected { slug: string; name: string }

interface SavedComparison {
  id: string;
  p1: Selected;
  p2: Selected;
  periodo: string;
  savedAt: string;
}

interface ComparisonState {
  version: 1;
  items: SavedComparison[];
}

interface MetricSummary { total: number | null; perMatch: number | null; per90: number | null }

interface CompareData {
  periodo: string;
  warning: string | null;
  template: 'goalkeeper' | 'field';
  players: Array<{
    slug: string;
    name: string;
    photoUrl: string | null;
    team: string | null;
    position: string | null;
    lastMatches: {
      summary: {
        matches: number;
        minutes: number;
        avgRating: number | null;
        metrics: Record<string, MetricSummary>;
        rates: Record<string, number | null>;
      };
    };
  }>;
}

const FIELD_ROWS = [
  { key: 'goals', label: 'Goles' },
  { key: 'assists', label: 'Asistencias' },
  { key: 'goalContributions', label: 'Goles + asistencias' },
  { key: 'shotsOnTarget', label: 'Tiros a puerta' },
  { key: 'keyPasses', label: 'Pases clave' },
  { key: 'duelsWon', label: 'Duelos ganados' },
  { key: 'tacklesWon', label: 'Entradas ganadas' },
  { key: 'interceptions', label: 'Intercepciones' },
] as const;

const GK_ROWS = [
  { key: 'saves', label: 'Paradas' },
  { key: 'goalsConceded', label: 'Goles encajados' },
  { key: 'cleanSheets', label: 'Porterías a cero' },
  { key: 'penaltiesSaved', label: 'Penaltis parados' },
] as const;

const PERIODS = [
  { value: '5', label: 'Últimos 5 partidos' },
  { value: '10', label: 'Últimos 10 partidos' },
  { value: 'temporada', label: 'Todos los disponibles' },
] as const;

const EXAMPLES: Array<{ label: string; p1: string; p2: string }> = [
  { label: 'Mbappé vs Haaland', p1: 'kylian-mbappe', p2: 'e-haaland' },
  { label: 'Messi vs Mbappé', p1: 'l-messi', p2: 'kylian-mbappe' },
  { label: 'Lamine Yamal vs Vinícius', p1: 'lamine-yamal', p2: 'vinicius-junior' },
  { label: 'Kane vs Guirassy', p1: 'h-kane', p2: 's-guirassy' },
];

const COMPARISONS_STORAGE_KEY = 'cornermaximo.comparisons.v1';

function loadSavedComparisons(): ComparisonState {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPARISONS_STORAGE_KEY) ?? 'null') as unknown;
    if (isComparisonState(parsed)) return parsed;
  } catch {
    // A malformed local snapshot must not make the comparison page unusable.
  }
  return { version: 1, items: [] };
}

function isComparisonState(value: unknown): value is ComparisonState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ComparisonState>;
  return candidate.version === 1 &&
    Array.isArray(candidate.items) &&
    candidate.items.length <= 20 &&
    candidate.items.every((item) =>
      item &&
      typeof item.id === 'string' &&
      typeof item.p1?.slug === 'string' &&
      typeof item.p1?.name === 'string' &&
      typeof item.p2?.slug === 'string' &&
      typeof item.p2?.name === 'string' &&
      PERIODS.some((period) => period.value === item.periodo) &&
      typeof item.savedAt === 'string',
    );
}

const fmt = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('es-ES'));

export function CompareClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [a, setA] = useState<Selected | null>(null);
  const [b, setB] = useState<Selected | null>(null);
  const [periodo, setPeriodo] = useState<string>('5');
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    state: savedComparisons,
    setState: setSavedComparisons,
    authenticated,
    status: syncStatus,
    error: syncError,
  } = useSyncedAccountState<ComparisonState>({
    stateKey: 'comparisons',
    storageKey: COMPARISONS_STORAGE_KEY,
    loadLocal: loadSavedComparisons,
    isValid: isComparisonState,
  });

  const syncUrl = useCallback(
    (pa: Selected | null, pb: Selected | null, per: string) => {
      const qs = new URLSearchParams();
      if (pa != null) qs.set('p1', pa.slug);
      if (pb != null) qs.set('p2', pb.slug);
      if (per !== '5') qs.set('periodo', per);
      const s = qs.toString();
      router.replace(s === '' ? '/comparador' : `/comparador?${s}`, { scroll: false });
    },
    [router],
  );

  const compare = useCallback(async (pa: Selected, pb: Selected, per: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/compare?players=${pa.slug},${pb.slug}&periodo=${per}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? 'No se pudo cargar la comparación. Inténtalo de nuevo.');
      }
      const payload = (await res.json()) as CompareData;
      setData(payload);
      // Completa los nombres reales si venían solo del URL
      setA({ slug: payload.players[0]!.slug, name: payload.players[0]!.name });
      setB({ slug: payload.players[1]!.slug, name: payload.players[1]!.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial desde la URL (enlace compartido o CTA del perfil)
  useEffect(() => {
    const p1 = searchParams.get('p1');
    const p2 = searchParams.get('p2');
    const per = PERIODS.some((p) => p.value === searchParams.get('periodo')) ? searchParams.get('periodo')! : '5';
    setPeriodo(per);
    if (p1 != null) setA((prev) => prev ?? { slug: p1, name: p1 });
    if (p2 != null) setB((prev) => prev ?? { slug: p2, name: p2 });
    if (p1 != null && p2 != null) void compare({ slug: p1, name: p1 }, { slug: p2, name: p2 }, per);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(side: 'a' | 'b', r: Selected) {
    const nextA = side === 'a' ? r : a;
    const nextB = side === 'b' ? r : b;
    if (side === 'a') setA(r);
    else setB(r);
    syncUrl(nextA, nextB, periodo);
    if (nextA != null && nextB != null) void compare(nextA, nextB, periodo);
  }

  function changePeriodo(per: string) {
    setPeriodo(per);
    syncUrl(a, b, per);
    if (a != null && b != null) void compare(a, b, per);
  }

  function swap() {
    if (a == null || b == null) return;
    setA(b);
    setB(a);
    syncUrl(b, a, periodo);
    void compare(b, a, periodo);
  }

  function clearAll() {
    setA(null);
    setB(null);
    setData(null);
    setError(null);
    syncUrl(null, null, '5');
    setPeriodo('5');
  }

  function loadExample(p1: string, p2: string) {
    const sa = { slug: p1, name: p1 };
    const sb = { slug: p2, name: p2 };
    setA(sa);
    setB(sb);
    syncUrl(sa, sb, periodo);
    void compare(sa, sb, periodo);
  }

  function saveCurrentComparison() {
    if (data == null) return;
    const first = { slug: data.players[0]!.slug, name: data.players[0]!.name };
    const second = { slug: data.players[1]!.slug, name: data.players[1]!.name };
    const id = `${[first.slug, second.slug].sort().join('|')}|${data.periodo}`;
    const item: SavedComparison = {
      id,
      p1: first,
      p2: second,
      periodo: data.periodo,
      savedAt: new Date().toISOString(),
    };
    setSavedComparisons((current) => ({
      version: 1,
      items: [item, ...(current?.items ?? []).filter((saved) => saved.id !== id)].slice(0, 20),
    }));
  }

  function loadSaved(item: SavedComparison) {
    setA(item.p1);
    setB(item.p2);
    setPeriodo(item.periodo);
    syncUrl(item.p1, item.p2, item.periodo);
    void compare(item.p1, item.p2, item.periodo);
  }

  function removeSaved(id: string) {
    setSavedComparisons((current) => current == null
      ? current
      : { ...current, items: current.items.filter((item) => item.id !== id) });
  }

  const rows = data?.template === 'goalkeeper' ? GK_ROWS : FIELD_ROWS;
  const periodLabel = PERIODS.find((p) => p.value === (data?.periodo ?? periodo))?.label ?? '';

  return (
    <div className="space-y-6">
      {/* Selectores */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-pitch-muted">Jugador A</p>
          <SearchBox placeholder="Buscar jugador…" onSelect={(r) => select('a', r)} />
          {a != null && <p className="truncate text-sm text-pitch-accent">{a.name}</p>}
        </div>
        <button
          type="button"
          onClick={swap}
          disabled={a == null || b == null}
          aria-label="Intercambiar jugadores"
          className="mx-auto rounded-lg border border-pitch-border p-2 text-pitch-muted outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-pitch-accent disabled:opacity-40 sm:mb-7"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h12m0 0-3-3m3 3-3 3M16 13H4m0 0 3-3m-3 3 3 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-pitch-muted">Jugador B</p>
          <SearchBox placeholder="Buscar jugador…" onSelect={(r) => select('b', r)} />
          {b != null && <p className="truncate text-sm text-pitch-accent">{b.name}</p>}
        </div>
      </div>

      {/* Periodo + limpiar */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div role="group" aria-label="Periodo de comparación" className="flex overflow-hidden rounded-lg border border-pitch-border">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => changePeriodo(p.value)}
              aria-pressed={periodo === p.value}
              className={`px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-pitch-accent ${
                periodo === p.value ? 'bg-pitch-accent/15 font-medium text-pitch-accent' : 'text-pitch-muted hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {(a != null || b != null) && (
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-pitch-border px-4 py-2 text-pitch-muted outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-pitch-accent"
          >
            Limpiar comparación
          </button>
        )}
      </div>

      {/* Ejemplos populares */}
      {data == null && !loading && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-pitch-muted">Comparaciones populares</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e.label}
                type="button"
                onClick={() => loadExample(e.p1, e.p2)}
                className="rounded-full border border-pitch-border px-4 py-1.5 text-sm text-pitch-muted outline-none hover:border-pitch-accent hover:text-white focus-visible:ring-2 focus-visible:ring-pitch-accent"
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(savedComparisons?.items.length ?? 0) > 0 && (
        <section className="fs-panel p-4" aria-labelledby="comparaciones-guardadas">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="comparaciones-guardadas" className="text-base font-bold">Comparaciones guardadas</h2>
            <span className="text-xs text-pitch-muted">
              {authenticated
                ? syncStatus === 'syncing' ? 'Sincronizando…' : syncStatus === 'error' ? syncError : 'Sincronizadas'
                : 'Solo en este dispositivo'}
            </span>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {savedComparisons!.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-lg border border-pitch-border bg-pitch-bg/50 p-2">
                <button type="button" onClick={() => loadSaved(item)} className="min-w-0 flex-1 rounded px-2 py-1 text-left text-sm font-medium hover:text-pitch-accent">
                  <span className="block truncate">{item.p1.name} vs {item.p2.name}</span>
                  <span className="block text-xs font-normal text-pitch-muted">{PERIODS.find((period) => period.value === item.periodo)?.label}</span>
                </button>
                <button type="button" onClick={() => removeSaved(item.id)} aria-label={`Eliminar ${item.p1.name} vs ${item.p2.name}`} className="min-h-11 rounded px-3 text-pitch-muted hover:text-pitch-danger">×</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!authenticated && (
        <p className="text-xs text-pitch-muted">
          <a href="/auth/login?next=/comparador" className="font-semibold text-pitch-accent hover:underline">Inicia sesión</a> para sincronizar tus comparaciones guardadas entre dispositivos.
        </p>
      )}

      {/* Estados */}
      {loading && (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm text-pitch-muted">Cargando comparación…</p>
          <div className="h-40 animate-pulse fs-panel" />
        </div>
      )}
      {error != null && (
        <div role="alert" className="rounded-xl border border-pitch-danger/40 bg-pitch-danger/10 px-4 py-3 text-sm text-pitch-danger">
          {error}
        </div>
      )}
      {data == null && !loading && error == null && (a == null || b == null) && (
        <p className="rounded-xl border border-dashed border-pitch-border p-6 text-center text-sm text-pitch-muted">
          Elige dos jugadores (o una comparación popular) para ver sus números frente a frente.
        </p>
      )}

      {/* Resultado */}
      {data != null && !loading && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={saveCurrentComparison} className="fs-btn-ghost px-4 py-2.5">Guardar comparación</button>
          </div>
          {data.warning != null && (
            <p className="rounded-lg border border-yellow-600/40 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
              {data.warning}
            </p>
          )}

          <p className="mb-1 text-xs text-pitch-muted sm:hidden" aria-hidden="true">Desliza la tabla lateralmente para ver todas las columnas →</p>
        <div className="overflow-x-auto rounded-xl border border-pitch-border">
            <table className="w-full min-w-[520px] bg-pitch-card text-sm">
              <caption className="sr-only">
                Comparación de {data.players[0]!.name} y {data.players[1]!.name} — {periodLabel}
              </caption>
              <thead>
                <tr className="border-b border-pitch-border text-xs uppercase text-pitch-muted">
                  <th scope="col" className="px-4 py-3 text-left">{periodLabel}</th>
                  {data.players.map((p) => (
                    <th key={p.slug} scope="col" className="px-4 py-3 text-center">
                      <a href={`/jugadores/${p.slug}`} className="hover:text-pitch-accent">
                        {p.name}
                      </a>
                      <span className="block text-[10px] font-normal normal-case">
                        {p.team ?? ''} {p.position != null ? `· ${p.position}` : ''}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SimpleRow label="Partidos" values={data.players.map((p) => p.lastMatches.summary.matches)} />
                <SimpleRow label="Minutos" values={data.players.map((p) => p.lastMatches.summary.minutes)} />
                <SimpleRow label="Valoración media" values={data.players.map((p) => p.lastMatches.summary.avgRating)} highlightMax />
                {rows.map((row) => (
                  <MetricRow
                    key={row.key}
                    label={row.label}
                    values={data.players.map((p) => p.lastMatches.summary.metrics[row.key] ?? null)}
                    lowerIsBetter={row.key === 'goalsConceded'}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-pitch-muted">
            En cada métrica: total, media por partido y valor por 90 minutos (cuando hay datos).
          </p>
        </div>
      )}
    </div>
  );
}

function SimpleRow({ label, values, highlightMax = false }: { label: string; values: Array<number | null>; highlightMax?: boolean }) {
  const present = values.filter((v): v is number => v != null);
  const best = highlightMax && present.length === values.length && new Set(present).size > 1 ? Math.max(...present) : null;
  return (
    <tr className="border-b border-pitch-border/50 last:border-0">
      <th scope="row" className="px-4 py-2 text-left font-normal text-pitch-muted">{label}</th>
      {values.map((v, i) => (
        <td key={i} className={`px-4 py-2 text-center font-medium ${best != null && v === best ? 'text-pitch-accent' : ''}`}>
          {fmt(v)}
          {best != null && v === best && <span className="sr-only"> (mejor)</span>}
        </td>
      ))}
    </tr>
  );
}

function MetricRow({
  label,
  values,
  lowerIsBetter,
}: {
  label: string;
  values: Array<{ total: number | null; perMatch: number | null; per90: number | null } | null>;
  lowerIsBetter: boolean;
}) {
  const totals = values.map((v) => v?.total ?? null);
  const present = totals.filter((v): v is number => v != null);
  const best =
    present.length === totals.length && new Set(present).size > 1
      ? lowerIsBetter
        ? Math.min(...present)
        : Math.max(...present)
      : null;
  return (
    <tr className="border-b border-pitch-border/50 last:border-0 align-top">
      <th scope="row" className="px-4 py-2 text-left font-normal text-pitch-muted">{label}</th>
      {values.map((v, i) => (
        <td key={i} className={`px-4 py-2 text-center ${best != null && v?.total === best ? 'text-pitch-accent' : ''}`}>
          <span className="font-semibold">{fmt(v?.total)}</span>
          {best != null && v?.total === best && <span className="sr-only"> (mejor)</span>}
          {(v?.perMatch != null || v?.per90 != null) && (
            <span className="block text-[11px] text-pitch-muted">
              {v?.perMatch != null ? `${fmt(v.perMatch)}/partido` : ''}
              {v?.perMatch != null && v?.per90 != null ? ' · ' : ''}
              {v?.per90 != null ? `${fmt(v.per90)}/90'` : ''}
            </span>
          )}
        </td>
      ))}
    </tr>
  );
}
