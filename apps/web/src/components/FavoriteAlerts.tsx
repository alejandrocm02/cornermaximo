'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { readFavorites, subscribeFavorites } from '@/lib/favorites';

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
const READ_KEY = 'futstats.alertas.read.v1';

function readIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 300) : [];
  } catch {
    return [];
  }
}

function alertLabel(alert: Alert): string {
  if (alert.type === 'LIVE') return 'En directo';
  if (alert.type === 'RESULT') return 'Resultado';
  return 'Próximo partido';
}

export function FavoriteAlerts() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [read, setRead] = useState<string[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => setRead(readIds()), []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const favorites = readFavorites();
      const params = new URLSearchParams();
      params.set('players', favorites.filter((item) => item.kind === 'player').map((item) => item.slug).join(','));
      params.set('teams', favorites.filter((item) => item.kind === 'team').map((item) => item.slug).join(','));
      params.set('competitions', favorites.filter((item) => item.kind === 'competition').map((item) => item.slug).join(','));
      try {
        const response = await fetch(`/api/alertas?${params.toString()}`);
        if (!response.ok) throw new Error('feed');
        const data = await response.json() as Feed;
        if (active) { setFeed(data); setError(false); }
      } catch {
        if (active) setError(true);
      }
    };
    void load();
    const unsubscribe = subscribeFavorites(() => void load());
    return () => { active = false; unsubscribe(); };
  }, []);

  const unread = useMemo(() => feed?.alerts.filter((alert) => !read.includes(alert.id)).length ?? 0, [feed, read]);
  const markAll = () => {
    const ids = feed?.alerts.map((alert) => alert.id) ?? [];
    setRead(ids);
    localStorage.setItem(READ_KEY, JSON.stringify(ids));
  };

  if (error) return <div className="fs-panel p-5 text-sm text-pitch-danger">No se pudieron cargar las alertas.</div>;
  if (feed == null) return <div className="h-56 fs-skeleton" />;
  if (feed.alerts.length === 0) return <div className="fs-panel p-8 text-center"><p className="font-semibold text-white">Sin novedades de favoritos</p><p className="mt-2 text-sm text-pitch-muted">Añade equipos, jugadores o ligas a favoritos para crear tu centro de alertas.</p><Link href="/favoritos" className="fs-btn-primary mt-4 inline-flex">Ir a favoritos</Link></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-pitch-muted">{unread} novedades sin leer · últimos 7 días y próximos 14</p>
        <button type="button" onClick={markAll} className="fs-btn-ghost text-xs">Marcar todo como leído</button>
      </div>
      <div className="space-y-3">
        {feed.alerts.map((alert) => {
          const isRead = read.includes(alert.id);
          return (
            <Link key={alert.id} href={`/partidos/${alert.matchId}`} className={`fs-panel block p-4 transition hover:border-pitch-accent ${isRead ? 'opacity-70' : 'border-pitch-accent/30'}`}>
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
    </div>
  );
}
