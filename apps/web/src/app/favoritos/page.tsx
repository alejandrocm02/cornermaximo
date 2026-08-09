import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FavoritesDashboard } from '@/components/FavoritesDashboard';

export const metadata: Metadata = {
  title: 'Favoritos | Mi Corner',
  description: 'Tu selección privada de equipos, jugadores, competiciones y próximos partidos en CornerMaximo.',
  alternates: { canonical: '/favoritos' },
  robots: { index: false, follow: false },
};

export default function FavoritesPage() {
  return <div className="space-y-8">
    <Breadcrumbs items={[{ label: 'Mi Corner', href: '/mi-futstats' }, { label: 'Favoritos' }]} />
    <header className="fs-panel relative overflow-hidden p-6 sm:p-8">
      <div aria-hidden="true" className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-pitch-accent/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-5"><div><p className="fs-eyebrow">MI CORNER · FAVORITOS</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Tu seguimiento</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-pitch-muted">Centraliza los equipos, jugadores y competiciones que más te importan. Con sesión iniciada se sincronizan de forma privada; como invitado permanecen únicamente en este navegador.</p></div><div className="flex flex-wrap gap-2"><Link href="/alertas" className="fs-btn-primary">Ver alertas</Link><Link href="/mi-futstats" className="fs-btn-ghost">Volver a Mi Corner</Link></div></div>
    </header>
    <FavoritesDashboard />
  </div>;
}
