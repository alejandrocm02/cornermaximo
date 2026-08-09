import type { Prisma } from '@prisma/client';
import { prisma } from '@futstats/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Mi FutStats',
  description: 'Tu panel personal de seguimiento, favoritos, partidos y watchlists en FutStats.',
  robots: { index: false, follow: false },
};

type FavoriteRow = {
  kind: 'player' | 'team' | 'competition';
  entity_slug: string;
  display_name: string;
  image_url: string | null;
  subtitle: string | null;
};

type WatchlistPlayerRow = { player_slug: string };

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  INJURED: 'Lesionado',
  SUSPENDED: 'Sancionado',
  DOUBT: 'Duda',
  NOT_CALLED: 'No convocado',
};

const STATUS_CLASS: Record<string, string> = {
  AVAILABLE: 'border-pitch-accent/30 bg-pitch-accent/10 text-pitch-accent',
  INJURED: 'border-pitch-danger/30 bg-pitch-danger/10 text-pitch-danger',
  SUSPENDED: 'border-pitch-warning/30 bg-pitch-warning/10 text-pitch-warning',
  DOUBT: 'border-pitch-warning/30 bg-pitch-warning/10 text-pitch-warning',
  NOT_CALLED: 'border-pitch-border bg-pitch-elevated text-pitch-muted',
};

function formatKickoff(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(date);
}

export default async function MyFutStatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/mi-futstats');

  const [favoritesResult, watchlistsResult, recentListsResult, watchlistPlayersResult] = await Promise.all([
    supabase
      .from('user_favorites')
      .select('kind,entity_slug,display_name,image_url,subtitle')
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
    supabase
      .from('user_watchlist_players')
      .select('player_slug')
      .eq('user_id', user.id)
      .limit(100),
  ]);

  const favoriteRows = (favoritesResult.data ?? []) as FavoriteRow[];
  const watchlistPlayers = (watchlistPlayersResult.data ?? []) as WatchlistPlayerRow[];
  const playerFavorites = favoriteRows.filter((row) => row.kind === 'player');
  const teamFavorites = favoriteRows.filter((row) => row.kind === 'team');
  const competitionFavorites = favoriteRows.filter((row) => row.kind === 'competition');
  const trackedPlayerSlugs = [...new Set([
    ...playerFavorites.map((row) => row.entity_slug),
    ...watchlistPlayers.map((row) => row.player_slug),
  ])].slice(0, 30);
  const trackedTeamSlugs = [...new Set(teamFavorites.map((row) => row.entity_slug))].slice(0, 20);
  const trackedCompetitionSlugs = [...new Set(competitionFavorites.map((row) => row.entity_slug))].slice(0, 20);

  let trackedPlayers: Awaited<ReturnType<typeof prisma.player.findMany>> = [];
  let upcomingMatches: Awaited<ReturnType<typeof prisma.match.findMany>> = [];
  let sportsDataError = false;

  try {
    trackedPlayers = trackedPlayerSlugs.length === 0
      ? []
      : await prisma.player.findMany({
          where: { slug: { in: trackedPlayerSlugs } },
          orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
          take: 8,
          select: {
            slug: true,
            fullName: true,
            knownAs: true,
            photoUrl: true,
            status: true,
            currentTeam: { select: { name: true, slug: true, crestUrl: true } },
          },
        });

    const relatedTeamSlugs = [...new Set([
      ...trackedTeamSlugs,
      ...trackedPlayers.flatMap((player) => player.currentTeam ? [player.currentTeam.slug] : []),
    ])];

    const orFilters: Prisma.MatchWhereInput[] = [];
    if (relatedTeamSlugs.length > 0) {
      orFilters.push({ teams: { some: { team: { slug: { in: relatedTeamSlugs } } } } });
    }
    if (trackedCompetitionSlugs.length > 0) {
      orFilters.push({ season: { competition: { slug: { in: trackedCompetitionSlugs } } } });
    }

    upcomingMatches = orFilters.length === 0
      ? []
      : await prisma.match.findMany({
          where: {
            status: 'SCHEDULED',
            kickoffAt: { gte: new Date() },
            OR: orFilters,
          },
          orderBy: { kickoffAt: 'asc' },
          take: 6,
          select: {
            id: true,
            kickoffAt: true,
            round: true,
            season: { select: { competition: { select: { name: true, slug: true } } } },
            teams: {
              select: {
                isHome: true,
                team: { select: { name: true, slug: true, crestUrl: true } },
              },
            },
          },
        });
  } catch {
    sportsDataError = true;
  }

  const watchlistCount = watchlistsResult.count ?? 0;
  const recentLists = recentListsResult.data ?? [];
  const personalDataError = Boolean(
    favoritesResult.error || watchlistsResult.error || recentListsResult.error || watchlistPlayersResult.error,
  );
  const unavailablePlayers = trackedPlayers.filter((player) => player.status !== 'AVAILABLE').length;

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Mi FutStats' }]} />

      <header className="relative overflow-hidden rounded-2xl border border-pitch-border bg-pitch-card/80 p-5 sm:p-7">
        <div aria-hidden="true" className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-pitch-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="fs-eyebrow">Tu centro de seguimiento</p>
            <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Mi FutStats</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-pitch-muted">
              Partidos, jugadores y listas que te importan reunidos en una sola pantalla privada y sincronizada con tu cuenta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/watchlists" className="fs-btn-primary">Nueva watchlist</Link>
            <Link href="/jugadores" className="fs-btn-ghost">Descubrir jugadores</Link>
          </div>
        </div>
      </header>

      {(personalDataError || sportsDataError) && (
        <p role="alert" className="rounded-xl border border-pitch-warning/40 bg-pitch-warning/10 px-4 py-3 text-sm text-pitch-warning">
          Parte del panel no se pudo actualizar. Tus datos personales siguen protegidos y puedes continuar usando FutStats.
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Resumen personal">
        {[
          { label: 'Jugadores', value: playerFavorites.length, href: '/favoritos' },
          { label: 'Equipos', value: teamFavorites.length, href: '/favoritos' },
          { label: 'Competiciones', value: competitionFavorites.length, href: '/favoritos' },
          { label: 'Watchlists', value: watchlistCount, href: '/watchlists' },
          { label: 'Atención', value: unavailablePlayers, href: '#jugadores-seguidos' },
        ].map((card) => (
          <Link key={card.label} href={card.href} className="fs-panel-interactive p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-pitch-muted">{card.label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-white">{card.value}</p>
          </Link>
        ))}
      </section>

      <section className="fs-panel p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="fs-eyebrow">Tu agenda</p>
            <h2 className="mt-1 text-2xl font-bold">Próximos partidos</h2>
          </div>
          <Link href="/partidos" className="text-sm font-semibold text-pitch-accent hover:underline">Ver calendario</Link>
        </div>

        {upcomingMatches.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {upcomingMatches.map((match) => {
              const home = match.teams.find((team) => team.isHome)?.team ?? null;
              const away = match.teams.find((team) => !team.isHome)?.team ?? null;
              return (
                <Link key={match.id} href={`/partidos/${match.id}`} className="rounded-xl border border-pitch-border bg-pitch-bg/50 p-4 transition hover:border-pitch-accent/40">
                  <div className="flex items-center justify-between gap-3 text-xs text-pitch-muted">
                    <span className="truncate">{match.season.competition.name}</span>
                    <time dateTime={match.kickoffAt.toISOString()} className="shrink-0">{formatKickoff(match.kickoffAt)}</time>
                  </div>
                  <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm font-semibold">
                    <span className="truncate text-right">{home?.name ?? '—'}</span>
                    <span className="text-pitch-muted">vs</span>
                    <span className="truncate">{away?.name ?? '—'}</span>
                  </div>
                  {match.round && <p className="mt-3 text-center text-xs text-pitch-muted">{match.round}</p>}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-pitch-border p-6 text-center">
            <p className="font-semibold">Tu agenda está vacía</p>
            <p className="mt-2 text-sm text-pitch-muted">Añade equipos, jugadores o competiciones a favoritos para personalizar próximos partidos.</p>
            <Link href="/favoritos" className="fs-btn-ghost mt-4 inline-flex">Gestionar favoritos</Link>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section id="jugadores-seguidos" className="fs-panel p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="fs-eyebrow">Seguimiento</p>
              <h2 className="mt-1 text-2xl font-bold">Jugadores seguidos</h2>
            </div>
            <Link href="/watchlists" className="text-sm font-semibold text-pitch-accent hover:underline">Organizar</Link>
          </div>

          {trackedPlayers.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {trackedPlayers.map((player) => (
                <Link key={player.slug} href={`/jugadores/${player.slug}`} className="flex items-center gap-3 rounded-xl border border-pitch-border bg-pitch-bg/50 p-3 transition hover:border-pitch-accent/40">
                  {player.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={player.photoUrl} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pitch-elevated text-pitch-muted">⚽</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{player.knownAs ?? player.fullName}</p>
                    <p className="truncate text-xs text-pitch-muted">{player.currentTeam?.name ?? 'Sin equipo'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${STATUS_CLASS[player.status] ?? STATUS_CLASS.NOT_CALLED}`}>
                    {STATUS_LABEL[player.status] ?? player.status}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-pitch-border p-6 text-center">
              <p className="font-semibold">Empieza a seguir jugadores</p>
              <p className="mt-2 text-sm text-pitch-muted">Marca jugadores como favoritos o añádelos a una watchlist para verlos aquí.</p>
              <Link href="/jugadores" className="fs-btn-primary mt-4 inline-flex">Explorar jugadores</Link>
            </div>
          )}
        </section>

        <section className="fs-panel p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4">
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
              <p className="mt-2 text-sm text-pitch-muted">Crea una lista privada para organizar jugadores por objetivo o perfil.</p>
              <Link href="/watchlists" className="fs-btn-primary mt-4 inline-flex">Crear primera lista</Link>
            </div>
          )}
        </section>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Accesos rápidos">
        {[
          { href: '/favoritos', title: 'Mis favoritos', copy: 'Gestiona jugadores, equipos y competiciones.' },
          { href: '/comparador', title: 'Comparador', copy: 'Pon frente a frente a los jugadores que sigues.' },
          { href: '/rankings', title: 'Rankings', copy: 'Descubre rendimiento destacado y nuevos perfiles.' },
          { href: '/cuenta/seguridad', title: 'Cuenta y seguridad', copy: 'Revisa tu identidad y sesión de FutStats.' },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="fs-panel-interactive p-4">
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 text-sm leading-5 text-pitch-muted">{item.copy}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
