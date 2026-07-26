'use client';

/**
 * Buscador global: jugadores, equipos y ligas.
 * Autocompletado con debounce, navegación por teclado (↑ ↓ Enter Esc),
 * foco visible, estado sin resultados y tolerancia a mayúsculas/acentos
 * (la normalización ocurre en /api/search).
 *
 * Con `onSelect` (modo comparador) solo muestra jugadores y no navega.
 */
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

interface PlayerResult { slug: string; name: string; photoUrl: string | null; team: string | null; href: string }
interface TeamResult { slug: string; name: string; crestUrl: string | null; isNational: boolean; href: string }
interface LeagueResult { slug: string; name: string; href: string }

interface SearchResponse { players: PlayerResult[]; teams: TeamResult[]; leagues: LeagueResult[] }

type Item =
  | { kind: 'player'; label: string; sub: string; img: string | null; href: string; slug: string }
  | { kind: 'team'; label: string; sub: string; img: string | null; href: string; slug: string }
  | { kind: 'league'; label: string; sub: string; img: null; href: string; slug: string };

const KIND_LABEL: Record<Item['kind'], string> = { player: 'Jugadores', team: 'Equipos', league: 'Ligas' };

export function SearchBox({
  placeholder = 'Busca un jugador, equipo o liga',
  onSelect,
}: {
  placeholder?: string;
  /** Modo selección (comparador): solo jugadores, no navega. */
  onSelect?: (r: { slug: string; name: string }) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const items: Item[] = useMemo(() => {
    if (data == null) return [];
    const players: Item[] = data.players.map((p) => ({
      kind: 'player', label: p.name, sub: p.team ?? '', img: p.photoUrl, href: p.href, slug: p.slug,
    }));
    if (onSelect != null) return players; // modo comparador: solo jugadores
    const teams: Item[] = data.teams.map((t) => ({
      kind: 'team', label: t.name, sub: t.isNational ? 'Selección' : 'Club', img: t.crestUrl, href: t.href, slug: t.slug,
    }));
    const leagues: Item[] = data.leagues.map((l) => ({
      kind: 'league', label: l.name, sub: 'Competición', img: null, href: l.href, slug: l.slug,
    }));
    return [...players, ...teams, ...leagues];
  }, [data, onSelect]);

  useEffect(() => {
    if (timer.current != null) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setData(null);
      setOpen(false);
      setActive(-1);
      return;
    }
    timer.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (res.ok) {
          setData((await res.json()) as SearchResponse);
          setOpen(true);
          setActive(-1);
        }
      } catch {
        // petición abortada o red caída: se ignora
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current != null) clearTimeout(timer.current);
    };
  }, [query]);

  function choose(item: Item) {
    setOpen(false);
    setQuery('');
    if (onSelect != null && item.kind === 'player') {
      onSelect({ slug: item.slug, name: item.label });
      return;
    }
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Enter' && active >= 0 && active < items.length) {
      e.preventDefault();
      choose(items[active]!);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  const showNoResults = open && !loading && items.length === 0 && query.trim().length >= 2;

  return (
    <div className="relative w-full max-w-xl">
      {/* Halo de foco: se ilumina cuando el campo recibe el foco. */}
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
          aria-expanded={open}
          aria-controls="global-search-list"
          aria-activedescendant={active >= 0 ? `search-item-${active}` : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => items.length > 0 && setOpen(true)}
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
          {items.map((item, i) => {
            const isFirstOfKind = i === 0 || items[i - 1]!.kind !== item.kind;
            return (
              <li key={`${item.kind}-${item.slug}`}>
                {isFirstOfKind && onSelect == null && (
                  <p className="sticky top-0 z-10 border-b border-pitch-border/50 bg-pitch-elevated/90 px-4 py-1.5 text-2xs font-semibold uppercase tracking-[0.18em] text-pitch-muted backdrop-blur">
                    {KIND_LABEL[item.kind]}
                  </p>
                )}
                <button
                  type="button"
                  id={`search-item-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(item);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left transition-colors ${
                    i === active
                      ? 'border-pitch-accent bg-pitch-accent/10'
                      : 'border-transparent hover:bg-pitch-elevated/70'
                  }`}
                >
                  {item.img != null ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img width={32} height={32} loading="lazy" decoding="async" src={item.img} alt="" className={item.kind === 'team' ? 'h-8 w-8 object-contain' : 'h-8 w-8 rounded-full object-cover'} />
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
    </div>
  );
}
