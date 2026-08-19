-- CornerMaximo account watchlists. Personal data only; sports data stays in Neon/Prisma.

create table if not exists public.user_watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.user_watchlist_players (
  watchlist_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_slug text not null check (player_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text not null check (char_length(display_name) between 1 and 160),
  image_url text,
  subtitle text,
  added_at timestamptz not null default now(),
  primary key (watchlist_id, player_slug),
  constraint user_watchlist_players_owner_fk
    foreign key (watchlist_id, user_id)
    references public.user_watchlists (id, user_id)
    on delete cascade
);

create index if not exists user_watchlists_user_updated_at_idx
  on public.user_watchlists (user_id, updated_at desc);

create index if not exists user_watchlist_players_user_added_at_idx
  on public.user_watchlist_players (user_id, added_at desc);

alter table public.user_watchlists enable row level security;
alter table public.user_watchlist_players enable row level security;

revoke all on table public.user_watchlists from anon;
revoke all on table public.user_watchlist_players from anon;

grant select, insert, update, delete on table public.user_watchlists to authenticated;
grant select, insert, update, delete on table public.user_watchlist_players to authenticated;

drop policy if exists "watchlists_select_own" on public.user_watchlists;
create policy "watchlists_select_own"
  on public.user_watchlists for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "watchlists_insert_own" on public.user_watchlists;
create policy "watchlists_insert_own"
  on public.user_watchlists for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "watchlists_update_own" on public.user_watchlists;
create policy "watchlists_update_own"
  on public.user_watchlists for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "watchlists_delete_own" on public.user_watchlists;
create policy "watchlists_delete_own"
  on public.user_watchlists for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "watchlist_players_select_own" on public.user_watchlist_players;
create policy "watchlist_players_select_own"
  on public.user_watchlist_players for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "watchlist_players_insert_own" on public.user_watchlist_players;
create policy "watchlist_players_insert_own"
  on public.user_watchlist_players for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "watchlist_players_update_own" on public.user_watchlist_players;
create policy "watchlist_players_update_own"
  on public.user_watchlist_players for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "watchlist_players_delete_own" on public.user_watchlist_players;
create policy "watchlist_players_delete_own"
  on public.user_watchlist_players for delete to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists user_watchlists_set_updated_at on public.user_watchlists;
create trigger user_watchlists_set_updated_at
before update on public.user_watchlists
for each row execute function public.set_updated_at();