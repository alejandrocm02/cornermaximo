-- Small, user-owned application snapshots for cross-device continuity.
-- Writes go through a definer function so clients cannot forge revisions or timestamps.
create table if not exists public.user_app_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  state_key text not null check (state_key in ('analyzer', 'comparisons')),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and pg_column_size(payload) <= 1048576
  ),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, state_key)
);

alter table public.user_app_state enable row level security;

revoke all on table public.user_app_state from anon, authenticated;
grant select on table public.user_app_state to authenticated;

create policy "app_state_select_own"
  on public.user_app_state
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.save_user_app_state(
  p_state_key text,
  p_payload jsonb
)
returns table(payload jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_state_key not in ('analyzer', 'comparisons') then
    raise exception 'Invalid state key' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 1048576 then
    raise exception 'Invalid state payload' using errcode = '22023';
  end if;

  insert into public.user_app_state as current_state (
    user_id,
    state_key,
    payload,
    revision,
    updated_at
  ) values (
    v_user_id,
    p_state_key,
    p_payload,
    1,
    now()
  )
  on conflict (user_id, state_key) do update
    set payload = excluded.payload,
        revision = current_state.revision + 1,
        updated_at = now();

  return query
    select state.payload, state.revision, state.updated_at
    from public.user_app_state as state
    where state.user_id = v_user_id and state.state_key = p_state_key;
end;
$$;

revoke all on function public.save_user_app_state(text, jsonb) from public, anon;
grant execute on function public.save_user_app_state(text, jsonb) to authenticated;
