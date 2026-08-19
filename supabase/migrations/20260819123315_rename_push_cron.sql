-- Reutiliza el secreto almacenado; no copia credenciales al historial SQL.
-- Se elimina cualquier job anterior para que la migración sea idempotente.
do $migration$
declare
  scheduled_job record;
begin
  for scheduled_job in
    select jobid from cron.job
    where jobname in ('futstats-push-alerts', 'cornermaximo-push-alerts')
  loop
    perform cron.unschedule(scheduled_job.jobid);
  end loop;

  perform cron.schedule(
    'cornermaximo-push-alerts',
    '*/10 * * * *',
    $command$
    select net.http_post(
      url := 'https://wkyqinuzeuppdjqazdsl.supabase.co/functions/v1/push-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cornermaximo-cron', (select cron_secret from private.push_runtime_config where singleton = true)
      ),
      body := '{}'::jsonb
    );
    $command$
  );
end;
$migration$;
