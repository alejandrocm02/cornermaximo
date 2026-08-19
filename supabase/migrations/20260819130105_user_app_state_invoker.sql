-- Keep the public RPC on caller privileges. RLS and this trigger enforce ownership
-- while server-side metadata remains impossible to forge through direct REST writes.
create or replace function public.enforce_user_app_state_metadata()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or new.user_id <> v_user_id then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.revision := 1;
  else
    new.user_id := old.user_id;
    new.revision := old.revision + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_app_state_metadata on public.user_app_state;
create trigger user_app_state_metadata
before insert or update on public.user_app_state
for each row execute function public.enforce_user_app_state_metadata();

grant insert, update on table public.user_app_state to authenticated;

create policy "app_state_insert_own"
  on public.user_app_state
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "app_state_update_own"
  on public.user_app_state
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.save_user_app_state(
  p_state_key text,
  p_payload jsonb
)
returns table(payload jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security invoker
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
    payload
  ) values (
    v_user_id,
    p_state_key,
    p_payload
  )
  on conflict (user_id, state_key) do update
    set payload = excluded.payload;

  return query
    select state.payload, state.revision, state.updated_at
    from public.user_app_state as state
    where state.user_id = v_user_id and state.state_key = p_state_key;
end;
$$;
