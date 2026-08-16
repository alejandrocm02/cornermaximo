-- CornerMaximo Pro entitlements are tied directly to Supabase Auth users.
-- Authenticated clients can only read their own entitlement. Billing writes are
-- reserved for trusted server/webhook code using the service role.

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'FREE' check (plan in ('FREE', 'PRO')),
  status text not null default 'inactive',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_status_idx
  on public.billing_subscriptions (status, current_period_end);

alter table public.billing_subscriptions enable row level security;

revoke all on table public.billing_subscriptions from anon;
revoke all on table public.billing_subscriptions from authenticated;
grant select on table public.billing_subscriptions to authenticated;

drop policy if exists "billing_subscriptions_select_own" on public.billing_subscriptions;
create policy "billing_subscriptions_select_own"
  on public.billing_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.billing_subscriptions is
  'Server-managed subscription state used to resolve CornerMaximo FREE/PRO entitlements.';
