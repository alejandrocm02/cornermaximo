-- Personal alert state belongs to Supabase Auth users.
-- Sports events themselves remain in Neon/Prisma and are never duplicated here.

create table if not exists public.user_alert_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  result_alerts boolean not null default true,
  live_alerts boolean not null default true,
  upcoming_alerts boolean not null default true,
  watchlist_players boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_alert_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id text not null check (alert_id ~ '^(result|live|upcoming)-[0-9]+$'),
  read_at timestamptz not null default now(),
  primary key (user_id, alert_id)
);

create index if not exists user_alert_reads_user_read_at_idx
  on public.user_alert_reads (user_id, read_at desc);

alter table public.user_alert_preferences enable row level security;
alter table public.user_alert_reads enable row level security;

revoke all on table public.user_alert_preferences from anon;
revoke all on table public.user_alert_reads from anon;

grant select, insert, update, delete on table public.user_alert_preferences to authenticated;
grant select, insert, update, delete on table public.user_alert_reads to authenticated;

create policy "alert_preferences_select_own"
  on public.user_alert_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "alert_preferences_insert_own"
  on public.user_alert_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "alert_preferences_update_own"
  on public.user_alert_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "alert_preferences_delete_own"
  on public.user_alert_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "alert_reads_select_own"
  on public.user_alert_reads for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "alert_reads_insert_own"
  on public.user_alert_reads for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "alert_reads_update_own"
  on public.user_alert_reads for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "alert_reads_delete_own"
  on public.user_alert_reads for delete to authenticated
  using ((select auth.uid()) = user_id);
