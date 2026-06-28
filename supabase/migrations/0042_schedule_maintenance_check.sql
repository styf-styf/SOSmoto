-- Programa la Edge Function check-maintenance para correr sola todos los dias,
-- sin depender de que el cliente abra la pantalla de Vehiculos. La clave de
-- servicio para autenticar la llamada se lee desde Supabase Vault (secreto
-- 'service_role_key'), nunca se guarda en texto plano en una migracion.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'check-maintenance-daily',
  '0 13 * * *',
  $$
  select net.http_post(
    url := 'https://logsjwjvberfsqjfqwob.supabase.co/functions/v1/check-maintenance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
