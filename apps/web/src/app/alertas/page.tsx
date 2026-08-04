import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FavoriteAlerts } from '@/components/FavoriteAlerts';

export const metadata: Metadata = {
  title: 'Alertas de favoritos',
  description: 'Resultados recientes y próximos partidos de tus equipos, jugadores y competiciones favoritas.',
  robots: { index: false, follow: false },
};

export default function AlertsPage() {
  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Favoritos', href: '/favoritos' }, { label: 'Alertas' }]} />
      <header className="fs-panel p-6 sm:p-8">
        <p className="fs-eyebrow">Tu seguimiento</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Alertas de favoritos</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-pitch-muted">
          Consulta resultados recientes, partidos en directo y próximos encuentros relacionados con tus favoritos. El estado de lectura se guarda únicamente en este navegador.
        </p>
        <Link href="/favoritos" className="fs-btn-ghost mt-4 inline-flex">Gestionar favoritos</Link>
      </header>
      <FavoriteAlerts />
    </div>
  );
}
