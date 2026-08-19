-- Estado histórico del cron desplegado. La migración posterior
-- rename_push_cron lo mueve al nombre y cabecera de CornerMaximo.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'futstats-push-alerts',
  '*/10 * * * *',
  $schedule$
  select net.http_post(
    url := 'https://wkyqinuzeuppdjqazdsl.supabase.co/functions/v1/push-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-futstats-cron', (select cron_secret from private.push_runtime_config where singleton = true)
    ),
    body := '{}'::jsonb
  );
  $schedule$
);
