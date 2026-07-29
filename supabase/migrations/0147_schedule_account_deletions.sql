-- Mismo patrón que check-subscription-expiry-daily (0050) / check-maintenance-daily
-- (0042) / check-business-growth-weekly (0047): programa la Edge Function
-- process-account-deletions para correr sola todos los días.
select cron.schedule(
  'process-account-deletions-daily',
  '10 13 * * *',
  $$
  select net.http_post(
    url := 'https://logsjwjvberfsqjfqwob.supabase.co/functions/v1/process-account-deletions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
