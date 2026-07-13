'use client';

/** Buscador global con autocompletado y debounce. */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface Result {
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  position: string | null;
}

export function SearchBox({
  placeholder = 'Busca un futbolista, p. ej. "Pedri"…',
  onSelect,
}: {
  placeholder?: string;
  /** Si se pasa, en lugar de navegar se notifica la selección (usado en el comparador). */
  onSelect?: (r: Result) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current != null) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/players?q=${encodeURIComponent(query.trim())}&pageSize=8`);
        if (res.ok) {
          const data = (await res.json()) as { results: Result[] };
          setResults(data.results);
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current != null) clearTimeout(timer.current);
    };
  }, [query]);

  return (
    <div className="relative w-full max-w-xl">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-pitch-border bg-pitch-card px-4 py-3 text-sm outline-none placeholder:text-pitch-muted focus:border-pitch-accent"
      />
      {loading && <span className="absolute right-4 top-3 text-xs text-pitch-muted">…</span>}
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-pitch-border bg-pitch-card shadow-xl">
          {results.map((r) =>
            onSelect != null ? (
              <li key={r.slug}>
                <button
                  type="button"
                  onMouseDown={() => {
                    onSelect(r);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-pitch-border/40"
                >
                  <ResultRow r={r} />
                </button>
              </li>
            ) : (
              <li key={r.slug}>
                <Link
                  href={`/jugadores/${r.slug}`}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-pitch-border/40"
                >
                  <ResultRow r={r} />
                </Link>
              </li>
            ),
          )}
        </ul>
      )}
      {open && !loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-10 mt-2 w-full rounded-xl border border-pitch-border bg-pitch-card px-4 py-3 text-sm text-pitch-muted">
          Sin resultados. La base de datos se llena tras la primera sincronización.
        </div>
      )}
    </div>
  );
}

function ResultRow({ r }: { r: Result }) {
  return (
    <>
      {r.photoUrl != null ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <span className="h-8 w-8 rounded-full bg-pitch-border" />
      )}
      <span className="flex-1 text-sm">{r.name}</span>
      <span className="text-xs text-pitch-muted">
        {r.position ?? ''} {r.team != null ? `· ${r.team}` : ''}
      </span>
    </>
  );
}
