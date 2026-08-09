import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { WatchlistsManager } from '@/components/WatchlistsManager';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Mis watchlists',
  description: 'Listas privadas de jugadores para seguir en FutStats.',
  robots: { index: false, follow: false },
};

export default async function WatchlistsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/watchlists');

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Mi FutStats', href: '/mi-futstats' }, { label: 'Watchlists' }]} />
      <header>
        <p className="fs-eyebrow">Scouting personal</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Mis watchlists</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-pitch-muted">
          Crea listas privadas de jugadores y mantenlas sincronizadas con tu cuenta en cualquier dispositivo.
        </p>
      </header>
      <WatchlistsManager />
    </div>
  );
}
