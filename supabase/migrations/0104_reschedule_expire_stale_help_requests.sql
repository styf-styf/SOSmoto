-- Baja la frecuencia del auto-cierre de auxilios colgados de cada 15 min a
-- cada hora -- cron.schedule() actualiza el job existente por nombre
-- (mismo job "expire-stale-help-requests" creado en 0103), no crea uno duplicado.
select cron.schedule(
  'expire-stale-help-requests',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://logsjwjvberfsqjfqwob.supabase.co/functions/v1/expire-stale-help-requests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
