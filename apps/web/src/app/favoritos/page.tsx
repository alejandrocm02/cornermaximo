import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FavoritesDashboard } from '@/components/FavoritesDashboard';

export const metadata: Metadata = {
  title: 'Mis favoritos',
  description: 'Tu selección privada de equipos, jugadores, ligas y próximos partidos en FutStats.',
  alternates: { canonical: '/favoritos' },
  robots: { index: false, follow: false },
};

export default function FavoritesPage() {
  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Mis favoritos' }]} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="fs-eyebrow">Tu FutStats</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Mis favoritos</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-pitch-muted">
            Sigue a tus equipos, jugadores y competiciones desde un único lugar. Si has iniciado sesión, la selección se sincroniza de forma privada con tu cuenta; como invitado permanece únicamente en este navegador.
          </p>
        </div>
        <Link href="/alertas" className="fs-btn-primary">Ver alertas</Link>
      </header>
      <FavoritesDashboard />
    </div>
  );
}
