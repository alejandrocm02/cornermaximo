import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { WatchlistsManager } from '@/components/WatchlistsManager';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Watchlists | Mi Corner', description: 'Listas privadas de jugadores para scouting y seguimiento en CornerMaximo.', robots: { index: false, follow: false } };
export default async function WatchlistsPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/auth/login?next=/watchlists');
  return <div className="space-y-8"><Breadcrumbs items={[{ label: 'Mi Corner', href: '/mi-futstats' }, { label: 'Watchlists' }]} />
    <header className="fs-panel relative overflow-hidden p-6 sm:p-8"><div aria-hidden="true" className="absolute right-0 top-0 h-52 w-64 bg-pitch-accent/10 blur-3xl"/><div className="relative"><p className="fs-eyebrow">MI CORNER · SCOUTING</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Watchlists</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-pitch-muted">Organiza jugadores en listas privadas para seguimiento, scouting y mercado. Tus listas permanecen sincronizadas con tu cuenta en cualquier dispositivo.</p></div></header>
    <WatchlistsManager />
  </div>;
}
