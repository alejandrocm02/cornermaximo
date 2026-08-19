-- El historial de entregas solo lo gestiona service_role. La política explícita
-- documenta la denegación aunque los privilegios ya estén revocados.
revoke all on table public.user_push_deliveries from anon, authenticated;

drop policy if exists "push_deliveries_deny_user_select" on public.user_push_deliveries;
create policy "push_deliveries_deny_user_select"
  on public.user_push_deliveries for select to authenticated
  using (false);
