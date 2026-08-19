-- Rate limiting duradero para el formulario del panel de sincronización.
-- Solo se guarda un hash con pepper de la IP, nunca la dirección original.
create table if not exists public.admin_auth_rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts between 0 and 1000),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.admin_auth_rate_limits enable row level security;
revoke all on table public.admin_auth_rate_limits from public, anon, authenticated;

create policy "admin_auth_rate_limits_deny_user_select"
  on public.admin_auth_rate_limits for select to authenticated
  using (false);

create or replace function public.consume_admin_auth_attempt(
  p_key_hash text,
  p_succeeded boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  rate_row public.admin_auth_rate_limits%rowtype;
  next_attempts integer;
  now_value timestamptz := clock_timestamp();
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid rate-limit key';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key_hash, 0));

  delete from public.admin_auth_rate_limits
  where updated_at < now_value - interval '7 days';

  select * into rate_row
  from public.admin_auth_rate_limits
  where key_hash = p_key_hash
  for update;

  if found and rate_row.blocked_until is not null and rate_row.blocked_until > now_value then
    return greatest(1, ceil(extract(epoch from rate_row.blocked_until - now_value))::integer);
  end if;

  if p_succeeded then
    delete from public.admin_auth_rate_limits where key_hash = p_key_hash;
    return 0;
  end if;

  if not found or rate_row.window_started_at <= now_value - interval '15 minutes' then
    insert into public.admin_auth_rate_limits (
      key_hash, window_started_at, attempts, blocked_until, updated_at
    ) values (
      p_key_hash, now_value, 1, null, now_value
    )
    on conflict (key_hash) do update set
      window_started_at = excluded.window_started_at,
      attempts = 1,
      blocked_until = null,
      updated_at = excluded.updated_at;
    return 0;
  end if;

  next_attempts := rate_row.attempts + 1;
  update public.admin_auth_rate_limits
  set attempts = next_attempts,
      blocked_until = case when next_attempts >= 5 then now_value + interval '15 minutes' else null end,
      updated_at = now_value
  where key_hash = p_key_hash;

  return case when next_attempts >= 5 then 900 else 0 end;
end;
$function$;

revoke all on function public.consume_admin_auth_attempt(text, boolean)
  from public, anon, authenticated;
grant execute on function public.consume_admin_auth_attempt(text, boolean)
  to service_role;
