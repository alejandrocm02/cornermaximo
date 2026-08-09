import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FavoriteAlerts } from '@/components/FavoriteAlerts';
import { PushNotificationSettings } from '@/components/PushNotificationSettings';

export const metadata: Metadata = {
  title: 'Centro de alertas',
  description: 'Resultados, directos y próximos partidos de tu seguimiento personal en FutStats.',
  robots: { index: false, follow: false },
};

export default function AlertsPage() {
  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Mi FutStats', href: '/mi-futstats' }, { label: 'Alertas' }]} />
      <header className="fs-panel p-6 sm:p-8">
        <p className="fs-eyebrow">Tu seguimiento</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Centro de alertas</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-pitch-muted">
          Reúne directos, resultados y próximos partidos de tus favoritos y jugadores de watchlists. Con sesión iniciada, las preferencias y el estado de lectura se sincronizan con tu cuenta.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/favoritos" className="fs-btn-ghost inline-flex">Gestionar favoritos</Link>
          <Link href="/watchlists" className="fs-btn-ghost inline-flex">Gestionar watchlists</Link>
        </div>
      </header>
      <PushNotificationSettings />
      <FavoriteAlerts />
    </div>
  );
}
