import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/LogoutButton';
import { createClient } from '@/lib/supabase/server';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?next=/cuenta');

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-2xl border border-pitch-border bg-pitch-card/80 p-6 shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-pitch-accent">Mi cuenta</p>
            <h1 className="font-display text-3xl font-bold text-white">Perfil FutStats</h1>
            <p className="mt-2 text-pitch-muted">Tu sesión está protegida por Supabase Auth.</p>
          </div>
          <LogoutButton />
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link href="/mi-futstats" className="rounded-xl border border-pitch-accent/30 bg-pitch-accent/5 p-4 transition hover:border-pitch-accent/60">
            <p className="font-display text-lg font-bold text-white">Mi FutStats</p>
            <p className="mt-1 text-sm text-pitch-muted">Abre tu dashboard personal de favoritos y seguimiento.</p>
          </Link>
          <Link href="/watchlists" className="rounded-xl border border-pitch-border bg-pitch-bg/60 p-4 transition hover:border-pitch-accent/40">
            <p className="font-display text-lg font-bold text-white">Mis watchlists</p>
            <p className="mt-1 text-sm text-pitch-muted">Organiza jugadores en listas privadas sincronizadas.</p>
          </Link>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-pitch-border bg-pitch-bg/60 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-pitch-muted">Correo</dt>
            <dd className="mt-2 break-all font-medium text-white">{user.email ?? 'Sin correo'}</dd>
          </div>
          <div className="rounded-xl border border-pitch-border bg-pitch-bg/60 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-pitch-muted">ID seguro</dt>
            <dd className="mt-2 break-all font-mono text-sm text-pitch-subtle">{user.id}</dd>
          </div>
        </dl>

        <div className="mt-6 rounded-xl border border-pitch-accent/20 bg-pitch-accent/5 p-4 text-sm leading-6 text-pitch-subtle">
          Las contraseñas no se almacenan en el código ni en la base deportiva de FutStats. Supabase gestiona las credenciales y la sesión.
        </div>
      </div>
    </section>
  );
}
