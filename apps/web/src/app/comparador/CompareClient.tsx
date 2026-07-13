'use client';

import { useState } from 'react';
import { SearchBox } from '@/components/SearchBox';

interface Selected {
  slug: string;
  name: string;
}

interface MetricSummary {
  total: number | null;
  perMatch: number | null;
  per90: number | null;
}

interface CompareData {
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

const FIELD_ROWS: Array<{ key: string; label: string }> = [
  { key: 'goals', label: 'Goles' },
  { key: 'assists', label: 'Asistencias' },
  { key: 'goalContributions', label: 'G+A' },
  { key: 'shotsOnTarget', label: 'Tiros a puerta' },
  { key: 'keyPasses', label: 'Pases clave' },
  { key: 'duelsWon', label: 'Duelos ganados' },
  { key: 'tacklesWon', label: 'Entradas ganadas' },
  { key: 'interceptions', label: 'Intercepciones' },
];

const GK_ROWS: Array<{ key: string; label: string }> = [
  { key: 'saves', label: 'Paradas' },
  { key: 'goalsConceded', label: 'Goles encajados' },
  { key: 'cleanSheets', label: 'Porterías a cero' },
  { key: 'penaltiesSaved', label: 'Penaltis parados' },
];

export function CompareClient() {
  const [a, setA] = useState<Selected | null>(null);
  const [b, setB] = useState<Selected | null>(null);
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compare(pa: Selected, pb: Selected) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/compare?players=${pa.slug},${pb.slug}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? 'Error al comparar');
      }
      setData((await res.json()) as CompareData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function select(side: 'a' | 'b', r: Selected) {
    const nextA = side === 'a' ? r : a;
    const nextB = side === 'b' ? r : b;
    if (side === 'a') setA(r);
    else setB(r);
    if (nextA != null && nextB != null) void compare(nextA, nextB);
  }

  const rows = data?.template === 'goalkeeper' ? GK_ROWS : FIELD_ROWS;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {(['a', 'b'] as const).map((side) => {
          const sel = side === 'a' ? a : b;
          return (
            <div key={side} className="space-y-2">
              <p className="text-xs font-semibold uppercase text-pitch-muted">Jugador {side.toUpperCase()}</p>
              <SearchBox placeholder="Buscar jugador…" onSelect={(r) => select(side, { slug: r.slug, name: r.name })} />
              {sel != null && <p className="text-sm text-pitch-accent">{sel.name}</p>}
            </div>
          );
        })}
      </div>

      {loading && <p className="text-sm text-pitch-muted">Comparando…</p>}
      {error != null && <p className="text-sm text-pitch-danger">{error}</p>}

      {data != null && (
        <div className="space-y-4">
          {data.warning != null && (
            <p className="rounded-lg border border-yellow-600/40 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
              {data.warning}
            </p>
          )}
          <div className="overflow-hidden rounded-xl border border-pitch-border">
            <table className="w-full bg-pitch-card text-sm">
              <thead>
                <tr className="border-b border-pitch-border text-xs uppercase text-pitch-muted">
                  <th className="px-4 py-3 text-left">Últimos 5 partidos</th>
                  {data.players.map((p) => (
                    <th key={p.slug} className="px-4 py-3 text-center">
                      {p.name}
                      <span className="block text-[10px] font-normal normal-case">{p.team ?? ''} · {p.position ?? ''}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label="Partidos" values={data.players.map((p) => p.lastMatches.summary.matches)} />
                <Row label="Minutos" values={data.players.map((p) => p.lastMatches.summary.minutes)} />
                <Row label="Valoración media" values={data.players.map((p) => p.lastMatches.summary.avgRating)} highlightMax />
                {rows.map((row) => (
                  <Row
                    key={row.key}
                    label={row.label}
                    values={data.players.map((p) => p.lastMatches.summary.metrics[row.key]?.total ?? null)}
                    highlightMax={row.key !== 'goalsConceded'}
                    highlightMin={row.key === 'goalsConceded'}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  values,
  highlightMax = false,
  highlightMin = false,
}: {
  label: string;
  values: Array<number | null>;
  highlightMax?: boolean;
  highlightMin?: boolean;
}) {
  const present = values.filter((v): v is number => v != null);
  const best =
    present.length === values.length && new Set(present).size > 1
      ? highlightMax
        ? Math.max(...present)
        : highlightMin
          ? Math.min(...present)
          : null
      : null;

  return (
    <tr className="border-b border-pitch-border/50 last:border-0">
      <td className="px-4 py-2 text-pitch-muted">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-4 py-2 text-center font-medium ${best != null && v === best ? 'text-pitch-accent' : ''}`}
        >
          {v ?? '—'}
        </td>
      ))}
    </tr>
  );
}
