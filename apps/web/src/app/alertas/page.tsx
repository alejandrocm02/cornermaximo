import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FavoriteAlerts } from '@/components/FavoriteAlerts';
import { PushNotificationSettings } from '@/components/PushNotificationSettings';

export const metadata: Metadata = { title: 'Centro de alertas | Mi Corner', description: 'Directos, resultados, próximos partidos y seguimiento personal en CornerMaximo.', robots: { index: false, follow: false } };
export default function AlertsPage() {
  return <div className="space-y-8"><Breadcrumbs items={[{ label: 'Mi Corner', href: '/mi-futstats' }, { label: 'Alertas' }]} />
    <header className="fs-panel relative overflow-hidden p-6 sm:p-8"><div aria-hidden="true" className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-pitch-danger/10 blur-3xl"/><div className="relative"><p className="fs-eyebrow">MI CORNER · ALERT CENTER</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Centro de alertas</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-pitch-muted">Sigue lo importante sin convertir la interfaz en ruido: directos, resultados, próximos partidos y señales relacionadas con tus favoritos y watchlists.</p><div className="mt-5 flex flex-wrap gap-2"><Link href="/favoritos" className="fs-btn-ghost">Gestionar favoritos</Link><Link href="/watchlists" className="fs-btn-ghost">Gestionar watchlists</Link><Link href="/mi-futstats" className="fs-btn-primary">Abrir Mi Corner</Link></div></div></header>
    <section aria-labelledby="push-heading"><div className="mb-3"><p className="fs-eyebrow">NOTIFICACIONES</p><h2 id="push-heading" className="mt-1 text-xl font-bold">Web Push</h2><p className="mt-1 text-sm text-pitch-muted">Controla desde aquí si CornerMaximo puede enviarte avisos compatibles con tu dispositivo y navegador.</p></div><PushNotificationSettings /></section>
    <section aria-labelledby="activity-heading"><div className="mb-3"><p className="fs-eyebrow">SEGUIMIENTO</p><h2 id="activity-heading" className="mt-1 text-xl font-bold">Actividad relevante</h2></div><FavoriteAlerts /></section>
  </div>;
}
