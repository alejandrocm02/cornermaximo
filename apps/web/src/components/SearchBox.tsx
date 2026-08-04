'use client';

/**
 * Buscador global: jugadores, equipos y ligas.
 * Autocompletado con debounce, caché breve en el navegador, navegación por
 * teclado y tolerancia a mayúsculas/acentos.
 *
 * Con `onSelect` (modo comparador) solo solicita jugadores y no navega.
 */
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

interface PlayerResult {
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  href: string;
}

interface TeamResult {
  slug: string;
  name: string;
  crestUrl: string | null;
  isNational: boolean;
  href: string;
}

interface LeagueResult {
  slug: string;
  name: string;
  href: string;
}

interface SearchResponse {
  players: PlayerResult[];
  teams: TeamResult[];
  leagues: LeagueResult[];
}

type Item =
  | { kind: 'player'; label: string; sub: string; img: string | null; href: string; slug: string }
  | { kind: 'team'; label: string; sub: string; img: string | null; href: string; slug: string }
  | { kind: 'league'; label: string; sub: string; img: null; href: string; slug: string };

const KIND_LABEL: Record<Item['kind'], string> = {
  player: 'Jugadores',
  team: 'Equipos',
  league: 'Ligas',
};

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
const CLIENT_CACHE_MAX_ENTRIES = 40;
const clientCache = new Map<string, { expiresAt: number; data: SearchResponse }>();

function normalizeCacheKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function readCachedResult(key: string): SearchResponse | null {
  const cached = clientCache.get(key);
  if (cached == null) return null;
  if (cached.expiresAt <= Date.now()) {
    clientCache.delete(key);
    return null;
  }

  // Reinserta la entrada para aproximar un orden LRU.
  clientCache.delete(key);
  clientCache.set(key, cached);
  return cached.data;
}

function cacheResult(key: string, data: SearchResponse) {
  if (!clientCache.has(key) && clientCache.size >= CLIENT_CACHE_MAX_ENTRIES) {
    const oldestKey = clientCache.keys().next().value as string | undefined;
    if (oldestKey != null) clientCache.delete(oldestKey);
  }
  clientCache.set(key, { expiresAt: Date.now() + CLIENT_CACHE_TTL_MS, data });
}

export function SearchBox({
  placeholder = 'Busca un jugador, equipo o liga',
  onSelect,
}: {
  placeholder?: string;
  /** Modo selección (comparador): solo jugadores, no navega. */
  onSelect?: (result: { slug: string; name: string }) => void;
}) {
  const router = useRouter();
  const scope = onSelect != null ? 'players' : 'all';
  const [query, setQuery] = useState('');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequest = useRef(0);

  const items: Item[] = useMemo(() => {
    if (data == null) return [];

    const players: Item[] = data.players.map((player) => ({
      kind: 'player',
      label: player.name,
      sub: player.team ?? '',
      img: player.photoUrl,
      href: player.href,
      slug: player.slug,
    }));
    if (onSelect != null) return players;

    const teams: Item[] = data.teams.map((team) => ({
      kind: 'team',
      label: team.name,
      sub: team.isNational ? 'Selección' : 'Club',
      img: team.crestUrl,
      href: team.href,
      slug: team.slug,
    }));
    const leagues: Item[] = data.leagues.map((league) => ({
      kind: 'league',
      label: league.name,
      sub: 'Competición',
      img: null,
      href: league.href,
      slug: league.slug,
    }));

    return [...players, ...teams, ...leagues];
  }, [data, onSelect]);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    let controller: AbortController | null = null;

    if (timer.current != null) clearTimeout(timer.current);

    const trimmedQuery = query.trim();
    const normalizedQuery = normalizeCacheKey(trimmedQuery);
    if (normalizedQuery.length < 2) {
      setData(null);
      setOpen(false);
      setActive(-1);
      setLoading(false);
      setError(false);
      return;
    }

    const cacheKey = `${scope}:${normalizedQuery}`;
    const cached = readCachedResult(cacheKey);
    if (cached != null) {
      setData(cached);
      setOpen(true);
      setActive(-1);
      setLoading(false);
      setError(false);
      return;
    }

    // No conserva resultados de una consulta anterior mientras cambia el texto.
    setData(null);
    setOpen(false);
    setActive(-1);
    setError(false);

    timer.current = setTimeout(async () => {
      controller = new AbortController();
      setLoading(true);

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmedQuery)}&scope=${scope}`,
          { signal: controller.signal, headers: { Accept: 'application/json' } },
        );
        if (!response.ok) throw new Error(`Search failed with status ${response.status}`);

        const result = (await response.json()) as SearchResponse;
        if (requestId !== latestRequest.current) return;

        cacheResult(cacheKey, result);
        setData(result);
        setOpen(true);
        setActive(-1);
      } catch {
        if (controller.signal.aborted || requestId !== latestRequest.current) return;
        setData(null);
        setOpen(true);
        setError(true);
      } finally {
        if (requestId === latestRequest.current) setLoading(false);
      }
    }, 350);

    return () => {
      if (timer.current != null) clearTimeout(timer.current);
      controller?.abort();
    };
  }, [query, scope]);

  function choose(item: Item) {
    setOpen(false);
    setQuery('');
    if (onSelect != null && item.kind === 'player') {
      onSelect({ slug: item.slug, name: item.label });
      return;
    }
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) {
      if (event.key === 'Escape') setOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((value) => (value + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((value) => (value <= 0 ? items.length - 1 : value - 1));
    } else if (event.key === 'Enter' && active >= 0 && active < items.length) {
      event.preventDefault();
      choose(items[active]!);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  const showNoResults =
    open && !loading && !error && items.length === 0 && query.trim().length >= 2;
  const showError = open && !loading && error;

  return (
    <div className="relative w-full max-w-xl">
      <div className="group relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-pitch-muted transition-colors group-focus-within:text-pitch-accent"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="9" r="6" />
            <path d="M13.5 13.5L17 17" strokeLinecap="round" />
          </svg>
        </span>
        <input
          aria-label={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-busy={loading}
          aria-controls="global-search-list"
          aria-activedescendant={active >= 0 ? `search-item-${active}` : undefined}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => (items.length > 0 || error) && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-pitch-border bg-pitch-card/80 py-3.5 pl-11 pr-11 text-sm text-white shadow-panel outline-none backdrop-blur transition placeholder:text-pitch-muted focus:border-pitch-accent/60 focus:shadow-glow"
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2" role="status" aria-label="Buscando">
            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-pitch-border border-t-pitch-accent" />
          </span>
        )}
      </div>

      {open && items.length > 0 && (
        <ul
          id="global-search-list"
          role="listbox"
          className="absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-2xl border border-pitch-border bg-pitch-card/95 shadow-float backdrop-blur-xl"
        >
          {items.map((item, index) => {
            const isFirstOfKind = index === 0 || items[index - 1]!.kind !== item.kind;
            return (
              <li key={`${item.kind}-${item.slug}`}>
                {isFirstOfKind && onSelect == null && (
                  <p className="sticky top-0 z-10 border-b border-pitch-border/50 bg-pitch-elevated/90 px-4 py-1.5 text-2xs font-semibold uppercase tracking-[0.18em] text-pitch-muted backdrop-blur">
                    {KIND_LABEL[item.kind]}
                  </p>
                )}
                <button
                  type="button"
                  id={`search-item-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(item);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={`flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left transition-colors ${
                    index === active
                      ? 'border-pitch-accent bg-pitch-accent/10'
                      : 'border-transparent hover:bg-pitch-elevated/70'
                  }`}
                >
                  {item.img != null ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      width={32}
                      height={32}
                      loading="lazy"
                      decoding="async"
                      src={item.img}
                      alt=""
                      className={item.kind === 'team' ? 'h-8 w-8 object-contain' : 'h-8 w-8 rounded-full object-cover'}
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pitch-border text-[10px] text-pitch-muted">
                      {item.kind === 'league' ? '🏆' : '·'}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                  <span className="shrink-0 text-xs text-pitch-muted">{item.sub}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showNoResults && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-pitch-border bg-pitch-card/95 px-4 py-3 text-sm text-pitch-muted shadow-float backdrop-blur-xl">
          Sin resultados para «{query.trim()}». Prueba con otro nombre.
        </div>
      )}

      {showError && (
        <div
          role="status"
          className="absolute z-20 mt-2 w-full rounded-2xl border border-pitch-danger/40 bg-pitch-card/95 px-4 py-3 text-sm text-pitch-subtle shadow-float backdrop-blur-xl"
        >
          No se pudo completar la búsqueda. Vuelve a intentarlo en unos segundos.
        </div>
      )}
    </div>
  );
}
