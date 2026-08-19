drop policy if exists "stripe_webhook_events_deny_user_select"
  on public.stripe_webhook_events;
create policy "stripe_webhook_events_deny_user_select"
  on public.stripe_webhook_events for select to authenticated
  using (false);
