'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { readFavorites } from '@/lib/favorites';
import { createClient } from '@/lib/supabase/client';

type Alert = {
  id: string;
  type: 'RESULT' | 'LIVE' | 'UPCOMING';
  matchId: number;
  kickoffAt: string;
  status: string;
  round: string | null;
  competition: { name: string; slug: string };
  home: { name: string; slug: string; crestUrl: string | null; goals: number | null } | null;
  away: { name: string; slug: string; crestUrl: string | null; goals: number | null } | null;
};

type Feed = { generatedAt: string; alerts: Alert[] };
type Preferences = {
  result_alerts: boolean;
  live_alerts: boolean;
  upcoming_alerts: boolean;
  watchlist_players: boolean;
};

type FavoriteRow = { kind: 'player' | 'team' | 'competition'; entity_slug: string };
type WatchlistPlayerRow = { player_slug: string };

const READ_KEY = 'cornermaximo.alertas.read.v1';
const DEFAULT_PREFERENCES: Preferences = {
  result_alerts: true,
  live_alerts: true,
  upcoming_alerts: true,
  watchlist_players: true,
};

function readLocalIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 300)
      : [];
  } catch {
    return [];
  }
}

function alertLabel(alert: Alert): string {
  if (alert.type === 'LIVE') return 'En directo';
  if (alert.type === 'RESULT') return 'Resultado';
  return 'Próximo partido';
}

function unique(values: string[]): string[] {
  return [...new Set(values)].slice(0, 20);
}

export function FavoriteAlerts() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [read, setRead] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id ?? null;
      if (!active) return;
      setUserId(uid);

      let playerSlugs: string[] = [];
      let teamSlugs: string[] = [];
      let competitionSlugs: string[] = [];
      let nextPreferences = DEFAULT_PREFERENCES;
      let readIds = readLocalIds();

      if (uid) {
        const [favoritesResult, watchlistResult, prefsResult, readsResult] = await Promise.all([
          supabase
            .from('user_favorites')
            .select('kind,entity_slug')
            .eq('user_id', uid),
          supabase
            .from('user_watchlist_players')
            .select('player_slug')
            .eq('user_id', uid),
          supabase
            .from('user_alert_preferences')
            .select('result_alerts,live_alerts,upcoming_alerts,watchlist_players')
            .eq('user_id', uid)
            .maybeSingle(),
          supabase
            .from('user_alert_reads')
            .select('alert_id')
            .eq('user_id', uid)
            .order('read_at', { ascending: false })
            .limit(500),
        ]);

        const firstError = favoritesResult.error ?? watchlistResult.error ?? prefsResult.error ?? readsResult.error;
        if (firstError) throw firstError;

        const favorites = (favoritesResult.data ?? []) as FavoriteRow[];
        const watchlistPlayers = (watchlistResult.data ?? []) as WatchlistPlayerRow[];
        nextPreferences = (prefsResult.data as Preferences | null) ?? DEFAULT_PREFERENCES;
        setPreferences(nextPreferences);
        readIds = (readsResult.data ?? []).map((row) => row.alert_id as string);

        playerSlugs = favorites.filter((item) => item.kind === 'player').map((item) => item.entity_slug);
        if (nextPreferences.watchlist_players) {
          playerSlugs.push(...watchlistPlayers.map((item) => item.player_slug));
        }
        teamSlugs = favorites.filter((item) => item.kind === 'team').map((item) => item.entity_slug);
        competitionSlugs = favorites.filter((item) => item.kind === 'competition').map((item) => item.entity_slug);
      } else {
        const favorites = readFavorites();
        playerSlugs = favorites.filter((item) => item.kind === 'player').map((item) => item.slug);
        teamSlugs = favorites.filter((item) => item.kind === 'team').map((item) => item.slug);
        competitionSlugs = favorites.filter((item) => item.kind === 'competition').map((item) => item.slug);
      }

      const params = new URLSearchParams();
      params.set('players', unique(playerSlugs).join(','));
      params.set('teams', unique(teamSlugs).join(','));
      params.set('competitions', unique(competitionSlugs).join(','));
      const response = await fetch(`/api/alertas?${params.toString()}`);
      if (!response.ok) throw new Error('No se pudo cargar el feed de alertas.');
      const data = (await response.json()) as Feed;
      if (!active) return;
      setRead(readIds);
      setFeed(data);
      setError(null);
    }

    void load().catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las alertas.');
    });
    return () => {
      active = false;
    };
  }, []);

  const visibleAlerts = useMemo(
    () =>
      (feed?.alerts ?? []).filter((alert) => {
        if (alert.type === 'RESULT') return preferences.result_alerts;
        if (alert.type === 'LIVE') return preferences.live_alerts;
        return preferences.upcoming_alerts;
      }),
    [feed, preferences],
  );
  const unread = useMemo(
    () => visibleAlerts.filter((alert) => !read.includes(alert.id)).length,
    [visibleAlerts, read],
  );

  async function persistRead(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    setRead((current) => [...new Set([...current, ...uniqueIds])]);
    if (!userId) {
      localStorage.setItem(READ_KEY, JSON.stringify([...new Set([...read, ...uniqueIds])].slice(0, 300)));
      return;
    }
    const supabase = createClient();
    const { error: writeError } = await supabase.from('user_alert_reads').upsert(
      uniqueIds.map((alertId) => ({ user_id: userId, alert_id: alertId, read_at: new Date().toISOString() })),
      { onConflict: 'user_id,alert_id' },
    );
    if (writeError) setError(writeError.message);
  }

  async function updatePreference(key: keyof Preferences, value: boolean) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    if (!userId) return;
    setBusy(true);
    const supabase = createClient();
    const { error: writeError } = await supabase.from('user_alert_preferences').upsert(
      { user_id: userId, ...next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    if (writeError) {
      setPreferences(preferences);
      setError(writeError.message);
    }
    setBusy(false);
  }

  if (error && feed == null) return <div className="fs-panel p-5 text-sm text-pitch-danger">{error}</div>;
  if (feed == null) return <div className="h-56 fs-skeleton" />;

  return (
    <div className="space-y-5">
      {userId ? (
        <section className="fs-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="fs-eyebrow">Preferencias</p>
              <h2 className="mt-1 text-lg font-bold text-white">Qué quieres seguir</h2>
              <p className="mt-1 text-sm text-pitch-muted">Se sincroniza con tu cuenta y queda preparado para futuros canales push.</p>
            </div>
            <span className="fs-chip">Cuenta sincronizada</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ['live_alerts', 'Partidos en directo'],
              ['result_alerts', 'Resultados'],
              ['upcoming_alerts', 'Próximos partidos'],
              ['watchlist_players', 'Jugadores de watchlists'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex min-h-11 items-center gap-3 rounded-xl border border-pitch-border bg-pitch-bg/50 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={preferences[key]}
                  disabled={busy}
                  onChange={(event) => void updatePreference(key, event.target.checked)}
                  className="h-4 w-4 accent-[var(--color-pitch-accent)]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-pitch-border bg-pitch-card/60 p-4 text-sm text-pitch-muted">
          Estás usando alertas locales. <Link href="/auth/login?next=/alertas" className="font-semibold text-pitch-accent hover:underline">Inicia sesión</Link> para sincronizar lectura y preferencias entre dispositivos.
        </div>
      )}

      {error && <p role="alert" className="rounded-xl border border-pitch-danger/40 bg-pitch-danger/10 px-4 py-3 text-sm text-pitch-danger">{error}</p>}

      {visibleAlerts.length === 0 ? (
        <div className="fs-panel p-8 text-center">
          <p className="font-semibold text-white">Sin novedades para tu seguimiento</p>
          <p className="mt-2 text-sm text-pitch-muted">Añade favoritos o jugadores a watchlists y activa los tipos de aviso que quieras ver.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/favoritos" className="fs-btn-primary">Ir a favoritos</Link>
            <Link href="/watchlists" className="fs-btn-ghost">Mis watchlists</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-pitch-muted">{unread} novedades sin leer · últimos 7 días y próximos 14</p>
            <button type="button" onClick={() => void persistRead(visibleAlerts.map((alert) => alert.id))} className="fs-btn-ghost text-xs">Marcar todo como leído</button>
          </div>
          <div className="space-y-3">
            {visibleAlerts.map((alert) => {
              const isRead = read.includes(alert.id);
              return (
                <Link
                  key={alert.id}
                  href={`/partidos/${alert.matchId}`}
                  onClick={() => void persistRead([alert.id])}
                  className={`fs-panel block p-4 transition hover:border-pitch-accent ${isRead ? 'opacity-70' : 'border-pitch-accent/30'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="fs-chip">{alertLabel(alert)}</span>
                    <time className="text-xs text-pitch-muted" dateTime={alert.kickoffAt}>{new Date(alert.kickoffAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'medium', timeStyle: 'short' })}</time>
                  </div>
                  <p className="mt-3 font-display text-lg font-semibold text-white">
                    {alert.home?.name ?? 'Local'} {alert.type === 'RESULT' || alert.type === 'LIVE' ? `${alert.home?.goals ?? '—'}–${alert.away?.goals ?? '—'}` : 'vs'} {alert.away?.name ?? 'Visitante'}
                  </p>
                  <p className="mt-1 text-xs text-pitch-muted">{alert.competition.name}{alert.round != null ? ` · ${alert.round}` : ''}</p>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
