-- Cierra automáticamente los auxilios "accepted"/"in_progress" que nadie
-- cerró (ni cliente ni taller) después de 3 horas desde que se aceptaron,
-- para no dejar a ninguno de los dos bloqueado de pedir/aceptar auxilios
-- nuevos indefinidamente. Mismo patrón que 0052 (update-help-request-eta).
select cron.schedule(
  'expire-stale-help-requests',
  '*/15 * * * *',
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
