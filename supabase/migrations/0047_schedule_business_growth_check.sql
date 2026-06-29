-- Programa check-business-growth semanalmente (lunes 13:00 UTC), mismo patron
-- que check-maintenance-daily (0042). Maximo ~1 sugerencia por negocio por
-- semana, asi que una corrida semanal es suficiente.
select cron.schedule(
  'check-business-growth-weekly',
  '0 13 * * 1',
  $$
  select net.http_post(
    url := 'https://logsjwjvberfsqjfqwob.supabase.co/functions/v1/check-business-growth',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
