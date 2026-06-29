-- La Edge Function check-subscription-expiry (push de "por vencer"/"vencio" +
-- downgrade automatico a Free) ya estaba desplegada pero nunca se programo
-- en pg_cron -- nunca se ejecutaba sola. Mismo patron que
-- check-maintenance-daily (0042) y check-business-growth-weekly (0047).
select cron.schedule(
  'check-subscription-expiry-daily',
  '5 13 * * *',
  $$
  select net.http_post(
    url := 'https://logsjwjvberfsqjfqwob.supabase.co/functions/v1/check-subscription-expiry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
