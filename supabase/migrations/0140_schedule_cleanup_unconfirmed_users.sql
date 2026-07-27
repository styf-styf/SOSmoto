-- Borra diariamente cuentas que nunca confirmaron su correo (código de 6
-- dígitos vencido y nunca ingresado) despues de 48h, para no acumular
-- basura en auth.users. Mismo patrón que check-subscription-expiry (0050).
select cron.schedule(
  'cleanup-unconfirmed-users-daily',
  '15 13 * * *',
  $$
  select net.http_post(
    url := 'https://logsjwjvberfsqjfqwob.supabase.co/functions/v1/cleanup-unconfirmed-users',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
