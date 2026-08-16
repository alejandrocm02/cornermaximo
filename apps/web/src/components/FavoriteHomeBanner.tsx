'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { readFavorites, subscribeFavorites, type FavoriteItem, type FavoriteKind } from '@/lib/favorites';

type HomeFeed = {
  upcomingMatches: Array<{
    id: number;
    kickoffAt: string;
    competition: { name: string };
    home: { name: string } | null;
    away: { name: string } | null;
  }>;
};

function feedParams(items: FavoriteItem[]): URLSearchParams {
  const params = new URLSearchParams();
  const set = (kind: FavoriteKind, key: string) => {
    const slugs = items.filter((item) => item.kind === kind).map((item) => item.slug);
    if (slugs.length > 0) params.set(key, slugs.join(','));
  };
  set('player', 'players');
  set('team', 'teams');
  set('competition', 'competitions');
  return params;
}

export function FavoriteHomeBanner() {
  const pathname = usePathname();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const update = () => setFavorites(readFavorites());
    setMounted(true);
    update();
    return subscribeFavorites(update);
  }, []);

  useEffect(() => {
    if (favorites.length === 0) {
      setFeed(null);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/favoritos?${feedParams(favorites).toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then((response) => (response.ok ? (response.json() as Promise<HomeFeed>) : null))
      .then((result) => setFeed(result))
      .catch(() => undefined);
    return () => controller.abort();
  }, [favorites]);

  if (!mounted || pathname !== '/' || favorites.length === 0) return null;
  const nextMatch = feed?.upcomingMatches[0];

  return (
    <section className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6 lg:px-8" aria-label="Resumen de favoritos">
      <div className="relative overflow-hidden rounded-2xl border border-pitch-accent/25 bg-pitch-card/80 p-4 shadow-glow-soft">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-grad-brand" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="fs-eyebrow">Mi Corner · {favorites.length} favoritos</p>
            {nextMatch == null ? (
              <p className="mt-1 text-sm text-pitch-muted">No hay próximos partidos sincronizados para tu selección.</p>
            ) : (
              <p className="mt-1 truncate text-sm text-pitch-subtle">
                Próximo: <span className="font-semibold text-white">{nextMatch.home?.name ?? '—'} vs {nextMatch.away?.name ?? '—'}</span>{' '}
                · {new Date(nextMatch.kickoffAt).toLocaleString('es-ES', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
                })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {nextMatch != null && (
              <Link href={`/partidos/${nextMatch.id}`} className="fs-btn-ghost">Ver partido</Link>
            )}
            <Link href="/favoritos" className="fs-btn-primary">Abrir favoritos</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
