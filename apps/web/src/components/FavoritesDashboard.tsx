'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  clearFavorites,
  readFavorites,
  removeFavorite,
  subscribeFavorites,
  type FavoriteItem,
  type FavoriteKind,
} from '@/lib/favorites';

type FeedEntity = {
  kind: FavoriteKind;
  slug: string;
  name: string;
  imageUrl: string | null;
  subtitle: string | null;
  href: string;
};

type FavoriteFeed = {
  generatedAt: string;
  players: FeedEntity[];
  teams: FeedEntity[];
  competitions: FeedEntity[];
  upcomingMatches: Array<{
    id: number;
    kickoffAt: string;
    round: string | null;
    competition: { name: string; slug: string; type: string };
    home: { name: string; slug: string; crestUrl: string | null } | null;
    away: { name: string; slug: string; crestUrl: string | null } | null;
  }>;
};

const KIND_LABEL: Record<FavoriteKind, string> = {
  player: 'Jugadores',
  team: 'Equipos',
  competition: 'Competiciones',
};

function paramsFor(items: FavoriteItem[]): URLSearchParams {
  const params = new URLSearchParams();
  const byKind = (kind: FavoriteKind) =>
    items.filter((item) => item.kind === kind).map((item) => item.slug);
  const players = byKind('player');
  const teams = byKind('team');
  const competitions = byKind('competition');
  if (players.length > 0) params.set('players', players.join(','));
  if (teams.length > 0) params.set('teams', teams.join(','));
  if (competitions.length > 0) params.set('competitions', competitions.join(','));
  return params;
}

function storedHref(item: FavoriteItem): string {
  if (item.kind === 'player') return `/jugadores/${item.slug}`;
  if (item.kind === 'team') return `/equipos/${item.slug}`;
  return `/ligas/${item.slug}`;
}

export function FavoritesDashboard() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [feed, setFeed] = useState<FavoriteFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const update = () => setFavorites(readFavorites());
    update();
    return subscribeFavorites(update);
  }, []);

  useEffect(() => {
    if (favorites.length === 0) {
      setFeed(null);
      setLoading(false);
      setError(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(`/api/favoritos?${paramsFor(favorites).toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<FavoriteFeed>;
      })
      .then((result) => setFeed(result))
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [favorites]);

  const entities = useMemo(() => {
    if (feed != null) return [...feed.players, ...feed.teams, ...feed.competitions];
    return favorites.map<FeedEntity>((item) => ({ ...item, href: storedHref(item) }));
  }, [favorites, feed]);

  const grouped = useMemo(
    () =>
      (['team', 'player', 'competition'] as const).map((kind) => ({
        kind,
        items: entities.filter((item) => item.kind === kind),
      })),
    [entities],
  );

  if (!loading && favorites.length === 0) {
    return (
      <section className="fs-panel px-5 py-10 text-center">
        <span aria-hidden="true" className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-pitch-elevated text-2xl">☆</span>
        <h2 className="mt-4 text-xl font-bold">Todavía no tienes favoritos</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-pitch-muted">
          Abre una ficha de jugador, equipo o liga y pulsa «Añadir a favoritos». La selección se guarda únicamente en este navegador.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/equipos" className="fs-btn-primary">Explorar equipos</Link>
          <Link href="/jugadores" className="fs-btn-ghost">Explorar jugadores</Link>
          <Link href="/ligas" className="fs-btn-ghost">Explorar ligas</Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-xl border border-pitch-border bg-pitch-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{favorites.length} favorito{favorites.length === 1 ? '' : 's'}</p>
          <p className="mt-1 text-xs text-pitch-muted">
            Guardados localmente. No se envían a una cuenta ni se comparten con terceros.
          </p>
        </div>
        <button
          type="button"
          onClick={() => clearFavorites()}
          className="fs-btn-ghost self-start text-pitch-danger sm:self-auto"
        >
          Vaciar favoritos
        </button>
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-pitch-danger/40 bg-pitch-danger/10 px-4 py-3 text-sm text-pitch-danger">
          No se pudo actualizar la información. Se muestran los datos guardados en el navegador.
        </p>
      )}

      {grouped.map((group) =>
        group.items.length > 0 ? (
          <section key={group.kind}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">
              {KIND_LABEL[group.kind]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <article key={`${item.kind}:${item.slug}`} className="fs-panel flex items-center gap-3 p-3">
                  {item.imageUrl != null ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                      className={`h-12 w-12 shrink-0 object-contain ${item.kind === 'player' ? 'rounded-full object-cover' : 'rounded-lg bg-white p-1'}`}
                    />
                  ) : (
                    <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-pitch-elevated text-pitch-muted">★</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={item.href} className="block truncate text-sm font-semibold hover:text-pitch-accent">
                      {item.name}
                    </Link>
                    <p className="truncate text-xs text-pitch-muted">{item.subtitle ?? KIND_LABEL[item.kind]}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Quitar ${item.name} de favoritos`}
                    onClick={() => setFavorites(removeFavorite(item))}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-pitch-muted transition hover:bg-pitch-danger/10 hover:text-pitch-danger"
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null,
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="fs-eyebrow">Agenda personalizada</p>
            <h2 className="mt-1 text-2xl font-bold">Próximos partidos</h2>
          </div>
          <Link href="/partidos" className="text-sm font-semibold text-pitch-accent hover:underline">Ver calendario completo</Link>
        </div>

        {loading && feed == null ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="fs-skeleton h-24 rounded-xl" />)}
          </div>
        ) : feed != null && feed.upcomingMatches.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {feed.upcomingMatches.map((match) => (
              <Link key={match.id} href={`/partidos/${match.id}`} className="fs-panel-interactive p-4">
                <div className="flex items-center justify-between gap-3 text-2xs text-pitch-muted">
                  <span>{match.competition.name}</span>
                  <time dateTime={match.kickoffAt}>
                    {new Date(match.kickoffAt).toLocaleString('es-ES', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
                    })}
                  </time>
                </div>
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-sm font-semibold">
                  <span className="truncate text-right">{match.home?.name ?? '—'}</span>
                  <span className="text-pitch-muted">vs</span>
                  <span className="truncate">{match.away?.name ?? '—'}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="fs-panel p-5 text-sm text-pitch-muted">
            No hay próximos partidos sincronizados para tus favoritos.
          </p>
        )}
      </section>
    </div>
  );
}
