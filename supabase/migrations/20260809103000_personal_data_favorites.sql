-- FutStats personal data lives in Supabase, alongside Supabase Auth.
-- Sports data remains in Neon/Prisma. Do not add sports tables here.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('player', 'team', 'competition')),
  entity_slug text not null check (entity_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text not null check (char_length(display_name) between 1 and 160),
  image_url text,
  subtitle text,
  added_at timestamptz not null default now(),
  primary key (user_id, kind, entity_slug)
);

create index if not exists user_favorites_user_added_at_idx
  on public.user_favorites (user_id, added_at desc);

alter table public.user_profiles enable row level security;
alter table public.user_favorites enable row level security;

revoke all on table public.user_profiles from anon;
revoke all on table public.user_favorites from anon;

grant select, insert, update, delete on table public.user_profiles to authenticated;
grant select, insert, update, delete on table public.user_favorites to authenticated;

drop policy if exists "profiles_select_own" on public.user_profiles;
create policy "profiles_select_own"
  on public.user_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "profiles_insert_own" on public.user_profiles;
create policy "profiles_insert_own"
  on public.user_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "profiles_update_own" on public.user_profiles;
create policy "profiles_update_own"
  on public.user_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "profiles_delete_own" on public.user_profiles;
create policy "profiles_delete_own"
  on public.user_profiles
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "favorites_select_own" on public.user_favorites;
create policy "favorites_select_own"
  on public.user_favorites
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "favorites_insert_own" on public.user_favorites;
create policy "favorites_insert_own"
  on public.user_favorites
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "favorites_update_own" on public.user_favorites;
create policy "favorites_update_own"
  on public.user_favorites
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "favorites_delete_own" on public.user_favorites;
create policy "favorites_delete_own"
  on public.user_favorites
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill accounts created before this migration.
insert into public.user_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;
