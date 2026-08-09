'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Watchlist = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type WatchlistPlayer = {
  watchlist_id: string;
  player_slug: string;
  display_name: string;
  image_url: string | null;
  subtitle: string | null;
  added_at: string;
};

type FavoritePlayer = {
  entity_slug: string;
  display_name: string;
  image_url: string | null;
  subtitle: string | null;
};

export function WatchlistsManager() {
  const [userId, setUserId] = useState<string | null>(null);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [players, setPlayers] = useState<WatchlistPlayer[]>([]);
  const [favorites, setFavorites] = useState<FavoritePlayer[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh(uid: string) {
    const supabase = createClient();
    const [listsResult, playersResult, favoritesResult] = await Promise.all([
      supabase
        .from('user_watchlists')
        .select('id,name,description,created_at,updated_at')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false }),
      supabase
        .from('user_watchlist_players')
        .select('watchlist_id,player_slug,display_name,image_url,subtitle,added_at')
        .eq('user_id', uid)
        .order('added_at', { ascending: false }),
      supabase
        .from('user_favorites')
        .select('entity_slug,display_name,image_url,subtitle')
        .eq('user_id', uid)
        .eq('kind', 'player')
        .order('added_at', { ascending: false }),
    ]);

    const firstError = listsResult.error ?? playersResult.error ?? favoritesResult.error;
    if (firstError) throw firstError;
    setWatchlists((listsResult.data ?? []) as Watchlist[]);
    setPlayers((playersResult.data ?? []) as WatchlistPlayer[]);
    setFavorites((favoritesResult.data ?? []) as FavoritePlayer[]);
  }

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data, error: authError }) => {
      if (!active) return;
      if (authError || !data.user) {
        setError('No se pudo validar la sesión.');
        setLoading(false);
        return;
      }
      setUserId(data.user.id);
      try {
        await refresh(data.user.id);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'No se pudieron cargar tus listas.');
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const playersByList = useMemo(() => {
    const map = new Map<string, WatchlistPlayer[]>();
    for (const player of players) {
      const current = map.get(player.watchlist_id) ?? [];
      current.push(player);
      map.set(player.watchlist_id, current);
    }
    return map;
  }, [players]);

  async function createWatchlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !name.trim()) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from('user_watchlists').insert({
      user_id: userId,
      name: name.trim(),
      description: description.trim() || null,
    });
    if (insertError) setError(insertError.message);
    else {
      setName('');
      setDescription('');
      await refresh(userId);
    }
    setBusy(false);
  }

  async function addPlayer(watchlistId: string, favorite: FavoritePlayer) {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from('user_watchlist_players').upsert(
      {
        watchlist_id: watchlistId,
        user_id: userId,
        player_slug: favorite.entity_slug,
        display_name: favorite.display_name,
        image_url: favorite.image_url,
        subtitle: favorite.subtitle,
      },
      { onConflict: 'watchlist_id,player_slug' },
    );
    if (insertError) setError(insertError.message);
    else await refresh(userId);
    setBusy(false);
  }

  async function removePlayer(watchlistId: string, playerSlug: string) {
    if (!userId) return;
    setBusy(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from('user_watchlist_players')
      .delete()
      .eq('user_id', userId)
      .eq('watchlist_id', watchlistId)
      .eq('player_slug', playerSlug);
    if (deleteError) setError(deleteError.message);
    else await refresh(userId);
    setBusy(false);
  }

  async function deleteWatchlist(id: string) {
    if (!userId) return;
    setBusy(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from('user_watchlists')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    if (deleteError) setError(deleteError.message);
    else await refresh(userId);
    setBusy(false);
  }

  if (loading) return <div className="fs-skeleton h-48 rounded-2xl" />;

  return (
    <div className="space-y-8">
      {error && (
        <p role="alert" className="rounded-xl border border-pitch-danger/40 bg-pitch-danger/10 px-4 py-3 text-sm text-pitch-danger">
          {error}
        </p>
      )}

      <form onSubmit={createWatchlist} className="fs-panel grid gap-4 p-5 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-semibold">
          Nombre de la lista
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            placeholder="Jóvenes promesas"
            className="rounded-lg border border-pitch-border bg-pitch-bg px-3 py-2.5 text-white outline-none focus:border-pitch-accent"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Descripción opcional
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={280}
            placeholder="Jugadores a seguir esta temporada"
            className="rounded-lg border border-pitch-border bg-pitch-bg px-3 py-2.5 text-white outline-none focus:border-pitch-accent"
          />
        </label>
        <button disabled={busy} className="fs-btn-primary disabled:opacity-50">Crear lista</button>
      </form>

      {watchlists.length === 0 ? (
        <section className="fs-panel p-8 text-center">
          <h2 className="text-xl font-bold">Crea tu primera watchlist</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-pitch-muted">
            Agrupa jugadores para seguirlos por scouting, mercado, fantasy o simple interés personal.
          </p>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {watchlists.map((watchlist) => {
            const listPlayers = playersByList.get(watchlist.id) ?? [];
            const availableFavorites = favorites.filter(
              (favorite) => !listPlayers.some((player) => player.player_slug === favorite.entity_slug),
            );
            return (
              <section key={watchlist.id} className="fs-panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-bold">{watchlist.name}</h2>
                    {watchlist.description && <p className="mt-1 text-sm text-pitch-muted">{watchlist.description}</p>}
                    <p className="mt-2 text-xs text-pitch-muted">{listPlayers.length} jugador{listPlayers.length === 1 ? '' : 'es'}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => deleteWatchlist(watchlist.id)}
                    className="text-xs font-semibold text-pitch-danger hover:underline disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>

                <div className="mt-5 space-y-2">
                  {listPlayers.map((player) => (
                    <div key={player.player_slug} className="flex items-center gap-3 rounded-xl border border-pitch-border bg-pitch-bg/50 p-3">
                      {player.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={player.image_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-pitch-elevated">⚽</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link href={`/jugadores/${player.player_slug}`} className="block truncate text-sm font-semibold hover:text-pitch-accent">
                          {player.display_name}
                        </Link>
                        <p className="truncate text-xs text-pitch-muted">{player.subtitle ?? 'Jugador'}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removePlayer(watchlist.id, player.player_slug)}
                        aria-label={`Quitar ${player.display_name} de ${watchlist.name}`}
                        className="grid h-9 w-9 place-items-center rounded-lg text-pitch-muted hover:bg-pitch-danger/10 hover:text-pitch-danger"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-pitch-border pt-4">
                  {availableFavorites.length > 0 ? (
                    <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-pitch-muted">
                      Añadir desde tus jugadores favoritos
                      <select
                        defaultValue=""
                        disabled={busy}
                        onChange={(event) => {
                          const favorite = favorites.find((item) => item.entity_slug === event.target.value);
                          if (favorite) void addPlayer(watchlist.id, favorite);
                          event.currentTarget.value = '';
                        }}
                        className="rounded-lg border border-pitch-border bg-pitch-bg px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-white"
                      >
                        <option value="" disabled>Seleccionar jugador…</option>
                        {availableFavorites.map((favorite) => (
                          <option key={favorite.entity_slug} value={favorite.entity_slug}>{favorite.display_name}</option>
                        ))}
                      </select>
                    </label>
                  ) : favorites.length === 0 ? (
                    <p className="text-sm text-pitch-muted">
                      Añade primero algún jugador a <Link href="/favoritos" className="font-semibold text-pitch-accent hover:underline">favoritos</Link> para incorporarlo a tus listas.
                    </p>
                  ) : (
                    <p className="text-sm text-pitch-muted">Todos tus jugadores favoritos ya están en esta lista.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
