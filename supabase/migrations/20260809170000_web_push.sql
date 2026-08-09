-- Web Push/PWA infrastructure.
-- Sports data remains in Neon; Supabase stores only per-account subscriptions,
-- delivery deduplication and runtime configuration.

alter table public.user_alert_preferences
  add column if not exists push_enabled boolean not null default false;

create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists user_push_subscriptions_user_idx
  on public.user_push_subscriptions (user_id, updated_at desc);

create table if not exists public.user_push_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id text not null check (alert_id ~ '^(result|live|upcoming)-[0-9]+$'),
  delivered_at timestamptz not null default now(),
  primary key (user_id, alert_id)
);

create index if not exists user_push_deliveries_delivered_idx
  on public.user_push_deliveries (delivered_at desc);

create table if not exists public.push_public_config (
  singleton boolean primary key default true check (singleton),
  vapid_public_key text not null,
  updated_at timestamptz not null default now()
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.push_runtime_config (
  singleton boolean primary key default true check (singleton),
  vapid_private_key text not null,
  cron_secret text not null,
  app_url text not null,
  updated_at timestamptz not null default now()
);
revoke all on table private.push_runtime_config from public, anon, authenticated;

create or replace function public.get_push_runtime_config()
returns table(vapid_private_key text, cron_secret text, app_url text)
language sql
security definer
set search_path = ''
as $$
  select c.vapid_private_key, c.cron_secret, c.app_url
  from private.push_runtime_config c
  where c.singleton = true;
$$;
revoke all on function public.get_push_runtime_config() from public, anon, authenticated;
grant execute on function public.get_push_runtime_config() to service_role;

alter table public.user_push_subscriptions enable row level security;
alter table public.user_push_deliveries enable row level security;
alter table public.push_public_config enable row level security;

revoke all on table public.user_push_subscriptions from anon;
grant select, insert, update, delete on table public.user_push_subscriptions to authenticated;

create policy "push_subscriptions_select_own"
  on public.user_push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "push_subscriptions_insert_own"
  on public.user_push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_update_own"
  on public.user_push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_delete_own"
  on public.user_push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Delivery history is service-only. RLS stays enabled with no user policies.
revoke all on table public.user_push_deliveries from anon, authenticated;

revoke insert, update, delete on table public.push_public_config from anon, authenticated;
grant select on table public.push_public_config to anon, authenticated;
create policy "push_public_config_read"
  on public.push_public_config for select to anon, authenticated
  using (singleton = true);
