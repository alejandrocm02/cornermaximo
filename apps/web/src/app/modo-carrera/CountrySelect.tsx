'use client';

/**
 * Selector de nacionalidad accesible con búsqueda.
 * - Lista completa de países y territorios futbolísticos (countries.ts).
 * - Búsqueda tolerante a mayúsculas y acentos.
 * - Recientes y populares como acceso rápido antes de la lista completa.
 * - Navegación completa por teclado (flechas, Enter, Escape, Inicio/Fin).
 * - La bandera es apoyo visual: el nombre siempre está presente como texto.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  FOOTBALL_COUNTRIES,
  POPULAR_CODES,
  countryByCode,
  countryFlag,
  searchCountries,
  type FootballCountry,
} from '@/lib/career/countries';

const RECENT_KEY = 'futstats.carrera.paisesRecientes.v1';
const MAX_RECENT = 6;

function loadRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw != null ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecent(code: string): void {
  if (typeof window === 'undefined') return;
  try {
    const next = [code, ...loadRecent().filter((c) => c !== code)].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Almacenamiento bloqueado: los recientes no son críticos.
  }
}

type Item = { kind: 'header'; label: string } | { kind: 'country'; country: FootballCountry };

function buildItems(query: string, recent: string[]): Item[] {
  if (query.trim() !== '') {
    return searchCountries(query).map((country) => ({ kind: 'country' as const, country }));
  }
  const items: Item[] = [];
  const recentCountries = recent.map(countryByCode).filter((c): c is FootballCountry => c != null);
  if (recentCountries.length > 0) {
    items.push({ kind: 'header', label: 'Recientes' });
    for (const country of recentCountries) items.push({ kind: 'country', country });
  }
  const popular = POPULAR_CODES.map(countryByCode).filter((c): c is FootballCountry => c != null);
  items.push({ kind: 'header', label: 'Populares' });
  for (const country of popular) items.push({ kind: 'country', country });
  items.push({ kind: 'header', label: 'Todos los países' });
  for (const country of FOOTBALL_COUNTRIES) items.push({ kind: 'country', country });
  return items;
}

export function CountrySelect({
  label,
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = 'Ninguna',
  excludeCode = null,
}: {
  label: string;
  value: string | null;
  onChange: (code: string | null) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  /** Código a ocultar (por ejemplo, la nacionalidad principal ya elegida). */
  excludeCode?: string | null;
}) {
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  const items = useMemo(() => {
    const all = buildItems(query, recent);
    return excludeCode == null ? all : all.filter((i) => i.kind !== 'country' || i.country.code !== excludeCode);
  }, [query, recent, excludeCode]);

  const selectableIndexes = useMemo(
    () => items.map((item, i) => (item.kind === 'country' ? i : -1)).filter((i) => i >= 0),
    [items],
  );

  // Cierre al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current != null && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Mantener visible la opción activa.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${baseId}-opt-${active}`)}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open, baseId]);

  const selected = value != null ? countryByCode(value) : null;

  const selectCountry = (code: string | null) => {
    onChange(code);
    if (code != null) {
      saveRecent(code);
      setRecent(loadRecent());
    }
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const moveActive = (delta: number) => {
    if (selectableIndexes.length === 0) return;
    const pos = selectableIndexes.indexOf(active);
    const nextPos = pos < 0 ? 0 : Math.min(selectableIndexes.length - 1, Math.max(0, pos + delta));
    setActive(selectableIndexes[nextPos] ?? selectableIndexes[0]!);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      setOpen(true);
      setActive(selectableIndexes[0] ?? 0);
      return;
    }
    if (!open) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveActive(-1);
        break;
      case 'Home':
        e.preventDefault();
        setActive(selectableIndexes[0] ?? 0);
        break;
      case 'End':
        e.preventDefault();
        setActive(selectableIndexes[selectableIndexes.length - 1] ?? 0);
        break;
      case 'Enter': {
        e.preventDefault();
        const item = items[active];
        if (item != null && item.kind === 'country') selectCountry(item.country.code);
        break;
      }
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1 text-sm">
      <label htmlFor={`${baseId}-input`} className="text-xs text-pitch-muted">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          id={`${baseId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${baseId}-listbox`}
          aria-activedescendant={open ? `${baseId}-opt-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={open ? query : selected != null ? selected.name : ''}
          placeholder={selected != null ? selected.name : 'Buscar país…'}
          onFocus={() => {
            setOpen(true);
            setQuery('');
            setActive(selectableIndexes[0] ?? 0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-pitch-border bg-pitch-bg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-pitch-accent"
        />
        {selected != null && (
          <span aria-hidden="true" className="shrink-0 text-lg">
            {countryFlag(selected.code)}
          </span>
        )}
      </div>
      {selected != null && (
        <p className="sr-only" aria-live="polite">
          Seleccionado: {selected.name}
        </p>
      )}
      {open && (
        <ul
          ref={listRef}
          id={`${baseId}-listbox`}
          role="listbox"
          aria-label={label}
          className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-pitch-border bg-pitch-card p-1 shadow-lg"
        >
          {allowEmpty && query.trim() === '' && (
            <li role="option" aria-selected={value == null} id={`${baseId}-opt-empty`}>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => selectCountry(null)}
                className="w-full rounded-md px-3 py-2 text-left text-pitch-muted hover:bg-pitch-border/40"
              >
                {emptyLabel}
              </button>
            </li>
          )}
          {items.length === 0 || selectableIndexes.length === 0 ? (
            <li className="px-3 py-2 text-xs text-pitch-muted">Sin resultados para «{query}».</li>
          ) : (
            items.map((item, i) =>
              item.kind === 'header' ? (
                <li key={`h-${item.label}`} role="presentation" className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-pitch-muted">
                  {item.label}
                </li>
              ) : (
                <li key={`${i}-${item.country.code}`} role="option" aria-selected={value === item.country.code} id={`${baseId}-opt-${i}`}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => selectCountry(item.country.code)}
                    onMouseMove={() => setActive(i)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left ${
                      i === active ? 'bg-pitch-accent/15 text-pitch-accent' : 'hover:bg-pitch-border/40'
                    }`}
                  >
                    <span aria-hidden="true">{countryFlag(item.country.code)}</span>
                    <span className="min-w-0 truncate">{item.country.name}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-pitch-muted">{item.country.code}</span>
                  </button>
                </li>
              ),
            )
          )}
        </ul>
      )}
    </div>
  );
}
