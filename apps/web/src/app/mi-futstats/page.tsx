import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Mi FutStats',
  description: 'Tu panel personal de favoritos y watchlists en FutStats.',
  robots: { index: false, follow: false },
};

export default async function MyFutStatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/mi-futstats');

  const [favoritesResult, watchlistsResult, recentListsResult] = await Promise.all([
    supabase
      .from('user_favorites')
      .select('kind', { count: 'exact', head: false })
      .eq('user_id', user.id),
    supabase
      .from('user_watchlists')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('user_watchlists')
      .select('id,name,description,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(3),
  ]);

  const favoriteRows = favoritesResult.data ?? [];
  const favoritePlayers = favoriteRows.filter((row) => row.kind === 'player').length;
  const favoriteTeams = favoriteRows.filter((row) => row.kind === 'team').length;
  const favoriteCompetitions = favoriteRows.filter((row) => row.kind === 'competition').length;
  const watchlistCount = watchlistsResult.count ?? 0;
  const recentLists = recentListsResult.data ?? [];
  const hasDataError = Boolean(favoritesResult.error || watchlistsResult.error || recentListsResult.error);

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Mi FutStats' }]} />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="fs-eyebrow">Tu producto personal</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Mi FutStats</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-pitch-muted">
            Tu espacio privado para seguir jugadores, equipos, competiciones y listas de scouting desde cualquier dispositivo.
          </p>
        </div>
        <Link href="/watchlists" className="fs-btn-primary self-start sm:self-auto">Nueva watchlist</Link>
      </header>

      {hasDataError && (
        <p role="alert" className="rounded-xl border border-pitch-warning/40 bg-pitch-warning/10 px-4 py-3 text-sm text-pitch-warning">
          Parte de tu información personal no se pudo cargar. Inténtalo de nuevo en unos segundos.
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen personal">
        {[
          { label: 'Jugadores favoritos', value: favoritePlayers, href: '/favoritos' },
          { label: 'Equipos favoritos', value: favoriteTeams, href: '/favoritos' },
          { label: 'Competiciones', value: favoriteCompetitions, href: '/favoritos' },
          { label: 'Watchlists', value: watchlistCount, href: '/watchlists' },
        ].map((card) => (
          <Link key={card.label} href={card.href} className="fs-panel-interactive p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-pitch-muted">{card.label}</p>
            <p className="mt-3 font-display text-3xl font-bold text-white">{card.value}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="fs-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="fs-eyebrow">Scouting</p>
              <h2 className="mt-1 text-2xl font-bold">Watchlists recientes</h2>
            </div>
            <Link href="/watchlists" className="text-sm font-semibold text-pitch-accent hover:underline">Ver todas</Link>
          </div>

          {recentLists.length > 0 ? (
            <div className="mt-5 space-y-3">
              {recentLists.map((list) => (
                <Link key={list.id} href="/watchlists" className="block rounded-xl border border-pitch-border bg-pitch-bg/50 p-4 transition hover:border-pitch-accent/40">
                  <p className="font-semibold">{list.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-pitch-muted">{list.description ?? 'Lista privada de jugadores'}</p>
                  <p className="mt-2 text-xs text-pitch-muted">Actualizada {new Date(list.updated_at).toLocaleDateString('es-ES')}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-pitch-border p-6 text-center">
              <p className="font-semibold">Todavía no tienes watchlists</p>
              <p className="mt-2 text-sm text-pitch-muted">Crea una lista y empieza a agrupar jugadores que quieras seguir.</p>
              <Link href="/watchlists" className="fs-btn-primary mt-4 inline-flex">Crear primera lista</Link>
            </div>
          )}
        </section>

        <section className="fs-panel p-5 sm:p-6">
          <p className="fs-eyebrow">Accesos rápidos</p>
          <h2 className="mt-1 text-2xl font-bold">Tu actividad</h2>
          <div className="mt-5 grid gap-3">
            <Link href="/favoritos" className="rounded-xl border border-pitch-border bg-pitch-bg/50 p-4 transition hover:border-pitch-accent/40">
              <p className="font-semibold">Mis favoritos</p>
              <p className="mt-1 text-sm text-pitch-muted">Jugadores, clubes y competiciones sincronizados con tu cuenta.</p>
            </Link>
            <Link href="/comparador" className="rounded-xl border border-pitch-border bg-pitch-bg/50 p-4 transition hover:border-pitch-accent/40">
              <p className="font-semibold">Comparador</p>
              <p className="mt-1 text-sm text-pitch-muted">Compara rápidamente jugadores que estés siguiendo.</p>
            </Link>
            <Link href="/cuenta/seguridad" className="rounded-xl border border-pitch-border bg-pitch-bg/50 p-4 transition hover:border-pitch-accent/40">
              <p className="font-semibold">Cuenta y seguridad</p>
              <p className="mt-1 text-sm text-pitch-muted">Revisa tu identidad y la sesión de FutStats.</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
