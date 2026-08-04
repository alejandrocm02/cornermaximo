import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getCurrentUser } from '@/lib/auth';
import { logoutAction } from './actions';

export const metadata: Metadata = {
  title: 'Mi cuenta',
  description: 'Gestiona tu cuenta y preferencias de FutStats.',
  alternates: { canonical: '/cuenta' },
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (user == null) redirect('/cuenta/acceso');

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Mi cuenta' }]} />
      <header>
        <p className="fs-eyebrow">Área personal</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Mi cuenta</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-pitch-muted">
          Tu sesión está activa y validada contra la base de datos de FutStats.
        </p>
      </header>

      <section className="fs-panel grid gap-5 p-5 sm:p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-pitch-muted">Correo</p>
          <p className="mt-1 font-display text-lg font-semibold text-white">{user.email}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-pitch-muted">Rol</p>
          <p className="mt-1 text-sm text-pitch-subtle">{user.role === 'USER' ? 'Usuario' : user.role}</p>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-pitch-border pt-5">
          <Link href="/favoritos" className="fs-btn-primary">Mis favoritos</Link>
          <Link href="/alertas" className="fs-btn-ghost">Alertas</Link>
          <form action={logoutAction} className="sm:ml-auto">
            <button type="submit" className="fs-btn-ghost">Cerrar sesión</button>
          </form>
        </div>
      </section>

      <section className="rounded-xl border border-pitch-warning/35 bg-pitch-warning/5 p-4 text-xs leading-5 text-pitch-muted">
        La sincronización automática de favoritos y del Analizador entre dispositivos se añadirá en el siguiente bloque. Esta primera versión crea la identidad y la sesión segura.
      </section>
    </div>
  );
}
