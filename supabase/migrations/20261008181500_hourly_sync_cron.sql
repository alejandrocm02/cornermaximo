-- Sincronización horaria de CornerMaximo lanzada desde Supabase (pg_cron + pg_net).
--
-- Motivo: el cron de GitHub Actions ('17 * * * *') se ejecutaba en la práctica
-- 3-4 veces al día (huecos de 4-7 h verificados el 8-oct-2026), y la web
-- promete "Actualización automática cada hora". pg_cron se ejecuta dentro de
-- la base de datos a la hora programada, sin la cola compartida de GitHub.
--
-- El job llama a POST https://cornermaximo.es/api/admin/sync/run con el mismo
-- Bearer SYNC_SECRET que usa GitHub. Lanza tres tandas por hora (minutos 17,
-- 27 y 37): cada tanda trabaja como máximo ~35 s y se detiene sola cuando no
-- queda trabajo o se agota el presupuesto diario de API-Football, así que las
-- tandas sobrantes apenas cuestan una consulta. Diez minutos de separación
-- evitan que dos tandas coincidan.
--
-- El secreto NO se escribe en esta migración: se guarda aparte en
-- private.sync_runtime_config (ver "Activación" al final). Mientras esa tabla
-- esté vacía, el job no hace ninguna petición.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.sync_runtime_config (
  singleton boolean primary key default true check (singleton),
  sync_secret text not null check (length(sync_secret) >= 32),
  app_url text not null default 'https://cornermaximo.es',
  updated_at timestamptz not null default now()
);
revoke all on table private.sync_runtime_config from public, anon, authenticated;

-- Idempotente: elimina una versión anterior del job antes de crearlo.
do $migration$
declare
  scheduled_job record;
begin
  for scheduled_job in
    select jobid from cron.job where jobname = 'cornermaximo-sync-hourly'
  loop
    perform cron.unschedule(scheduled_job.jobid);
  end loop;

  perform cron.schedule(
    'cornermaximo-sync-hourly',
    '17,27,37 * * * *',
    $command$
    select net.http_post(
      url := c.app_url || '/api/admin/sync/run',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || c.sync_secret
      ),
      body := '{"maxRequests":200}'::jsonb,
      -- La función de Vercel puede tardar hasta ~40 s; el valor por defecto
      -- de pg_net (5 s) cortaría la conexión antes de que termine.
      timeout_milliseconds := 58000
    )
    from private.sync_runtime_config c
    where c.singleton;
    $command$
  );
end;
$migration$;

-- ============================ Activación ============================
-- Ejecutar una sola vez, en el SQL Editor de Supabase, con el valor real de
-- SYNC_SECRET (el mismo que tienen Vercel y GitHub). No lo guardes en el repo.
--
--   insert into private.sync_runtime_config (sync_secret)
--   values ('<SYNC_SECRET>')
--   on conflict (singleton)
--   do update set sync_secret = excluded.sync_secret, updated_at = now();
--
-- ============================ Comprobación ============================
-- Últimas ejecuciones del job (debe aparecer 'succeeded' cada hora):
--   select start_time, status, return_message
--   from cron.job_run_details d
--   join cron.job j on j.jobid = d.jobid
--   where j.jobname = 'cornermaximo-sync-hourly'
--   order by start_time desc limit 6;
--
-- Respuestas HTTP del endpoint (status_code 200 = tanda correcta):
--   select created, status_code, left(content, 160) as respuesta, error_msg
--   from net._http_response order by created desc limit 6;
