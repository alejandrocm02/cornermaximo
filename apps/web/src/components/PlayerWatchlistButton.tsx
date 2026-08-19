'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Watchlist = {
  id: string;
  name: string;
};

type Props = {
  player: {
    slug: string;
    name: string;
    imageUrl: string | null;
    subtitle: string | null;
  };
};

export function PlayerWatchlistButton({ player }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [memberships, setMemberships] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setUserId(null);
      setWatchlists([]);
      setMemberships(new Set());
      setLoading(false);
      return;
    }

    const uid = authData.user.id;
    setUserId(uid);
    const [listsResult, membershipResult] = await Promise.all([
      supabase
        .from('user_watchlists')
        .select('id,name')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false }),
      supabase
        .from('user_watchlist_players')
        .select('watchlist_id')
        .eq('user_id', uid)
        .eq('player_slug', player.slug),
    ]);

    const firstError = listsResult.error ?? membershipResult.error;
    if (firstError) setError(firstError.message);
    else {
      setWatchlists((listsResult.data ?? []) as Watchlist[]);
      setMemberships(new Set((membershipResult.data ?? []).map((row) => row.watchlist_id as string)));
    }
    setLoading(false);
  }, [player.slug]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  async function toggle(watchlistId: string) {
    if (!userId) return;
    setBusyId(watchlistId);
    setError(null);
    const supabase = createClient();
    const active = memberships.has(watchlistId);
    const result = active
      ? await supabase
          .from('user_watchlist_players')
          .delete()
          .eq('user_id', userId)
          .eq('watchlist_id', watchlistId)
          .eq('player_slug', player.slug)
      : await supabase.from('user_watchlist_players').upsert(
          {
            watchlist_id: watchlistId,
            user_id: userId,
            player_slug: player.slug,
            display_name: player.name,
            image_url: player.imageUrl,
            subtitle: player.subtitle,
          },
          { onConflict: 'watchlist_id,player_slug' },
        );

    if (result.error) setError(result.error.message);
    else {
      setMemberships((current) => {
        const next = new Set(current);
        if (active) next.delete(watchlistId);
        else next.add(watchlistId);
        return next;
      });
    }
    setBusyId(null);
  }

  return (
    <div className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="fs-btn-ghost w-full justify-center sm:w-auto"
      >
        {memberships.size > 0 ? `En ${memberships.size} watchlist${memberships.size === 1 ? '' : 's'}` : 'Añadir a watchlist'}
      </button>

      {open && (
        <div className="mt-2 w-full rounded-xl border border-pitch-border bg-pitch-card p-3 shadow-xl sm:absolute sm:right-0 sm:z-20 sm:w-80">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Mis watchlists</p>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-pitch-muted hover:text-white">Cerrar</button>
          </div>

          {loading ? (
            <div className="mt-3 h-20 fs-skeleton" />
          ) : !userId ? (
            <div className="mt-3 rounded-lg border border-pitch-border bg-pitch-bg/60 p-3 text-sm text-pitch-muted">
              <p>Inicia sesión para guardar este jugador en tus listas.</p>
              <Link href={`/auth/login?next=/jugadores/${player.slug}`} className="mt-3 inline-flex font-semibold text-pitch-accent hover:underline">Iniciar sesión</Link>
            </div>
          ) : watchlists.length === 0 ? (
            <div className="mt-3 rounded-lg border border-pitch-border bg-pitch-bg/60 p-3 text-sm text-pitch-muted">
              <p>Todavía no tienes ninguna watchlist.</p>
              <Link href="/watchlists" className="mt-3 inline-flex font-semibold text-pitch-accent hover:underline">Crear una watchlist</Link>
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              {watchlists.map((watchlist) => {
                const active = memberships.has(watchlist.id);
                return (
                  <button
                    key={watchlist.id}
                    type="button"
                    disabled={busyId != null}
                    onClick={() => void toggle(watchlist.id)}
                    className={`flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-50 ${active ? 'border-pitch-accent/50 bg-pitch-accent/10 text-white' : 'border-pitch-border bg-pitch-bg/60 text-pitch-subtle hover:border-pitch-accent/40'}`}
                  >
                    <span className="truncate font-medium">{watchlist.name}</span>
                    <span aria-hidden="true" className={active ? 'text-pitch-accent' : 'text-pitch-muted'}>{active ? '✓' : '+'}</span>
                  </button>
                );
              })}
            </div>
          )}

          {error && <p role="alert" className="mt-3 text-xs text-pitch-danger">{error}</p>}
          {userId && watchlists.length > 0 && (
            <Link href="/watchlists" className="mt-3 inline-flex text-xs font-semibold text-pitch-accent hover:underline">Gestionar todas las listas</Link>
          )}
        </div>
      )}
    </div>
  );
}
