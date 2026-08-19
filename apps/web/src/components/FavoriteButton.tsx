'use client';

import { useEffect, useState } from 'react';
import {
  hasFavorite,
  persistFavoriteForCurrentUser,
  subscribeFavorites,
  toggleFavorite,
  type FavoriteItem,
} from '@/lib/favorites';

type FavoriteButtonItem = Omit<FavoriteItem, 'addedAt'>;

export function FavoriteButton({ item }: { item: FavoriteButtonItem }) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);

  useEffect(() => {
    const identity = { kind: item.kind, slug: item.slug };
    const update = () => setActive(hasFavorite(identity));
    setMounted(true);
    update();
    return subscribeFavorites(update);
  }, [item.kind, item.slug]);

  function handleClick() {
    const result = toggleFavorite(item);
    setActive(result.active);
    setSyncFailed(false);

    void persistFavoriteForCurrentUser(item, result.active).then(({ error }) => {
      setSyncFailed(error != null);
    });
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Quitar ${item.name} de favoritos` : `Añadir ${item.name} a favoritos`}
      title={syncFailed ? 'No se pudo sincronizar con tu cuenta. El cambio permanece temporalmente en este dispositivo.' : undefined}
      onClick={handleClick}
      className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-pitch-accent ${
        active
          ? 'border-amber-300/50 bg-amber-300/10 text-amber-200'
          : 'border-pitch-border bg-pitch-card/70 text-pitch-subtle hover:border-pitch-accent/40 hover:text-white'
      }`}
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      >
        <path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 2.8Z" />
      </svg>
      <span>{!mounted ? 'Favorito' : active ? 'En favoritos' : 'Añadir a favoritos'}</span>
      {syncFailed ? <span className="sr-only">Sincronización pendiente</span> : null}
    </button>
  );
}
