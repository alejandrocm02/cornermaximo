-- Ledger transaccional de Stripe: reclama cada evento una sola vez y evita que
-- una entrega retrasada sobrescriba un estado de suscripción más reciente.
create table if not exists public.stripe_webhook_events (
  event_id text primary key check (char_length(event_id) between 8 and 255),
  event_type text not null check (char_length(event_type) between 3 and 160),
  event_created timestamptz not null,
  processed_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_created_idx
  on public.stripe_webhook_events (event_created desc);

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;

alter table public.billing_subscriptions
  add column if not exists stripe_event_id text,
  add column if not exists stripe_event_created timestamptz;

create index if not exists billing_subscriptions_event_created_idx
  on public.billing_subscriptions (stripe_event_created desc);

create or replace function public.apply_stripe_subscription_event(
  p_event_id text,
  p_event_type text,
  p_event_created timestamptz,
  p_user_id uuid,
  p_status text,
  p_customer_id text,
  p_subscription_id text,
  p_price_id text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  claimed_event_id text;
begin
  insert into public.stripe_webhook_events (
    event_id,
    event_type,
    event_created
  ) values (
    p_event_id,
    p_event_type,
    p_event_created
  )
  on conflict (event_id) do nothing
  returning event_id into claimed_event_id;

  if claimed_event_id is null then
    return false;
  end if;

  insert into public.billing_subscriptions (
    user_id,
    plan,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    stripe_event_id,
    stripe_event_created,
    updated_at
  ) values (
    p_user_id,
    'PRO',
    p_status,
    p_customer_id,
    p_subscription_id,
    p_price_id,
    p_current_period_start,
    p_current_period_end,
    p_cancel_at_period_end,
    p_event_id,
    p_event_created,
    now()
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_price_id = excluded.stripe_price_id,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    stripe_event_id = excluded.stripe_event_id,
    stripe_event_created = excluded.stripe_event_created,
    updated_at = now()
  where public.billing_subscriptions.stripe_event_created is null
     or public.billing_subscriptions.stripe_event_created <= excluded.stripe_event_created;

  return true;
end;
$function$;

revoke all on function public.apply_stripe_subscription_event(
  text, text, timestamptz, uuid, text, text, text, text,
  timestamptz, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(
  text, text, timestamptz, uuid, text, text, text, text,
  timestamptz, timestamptz, boolean
) to service_role;
