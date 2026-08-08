-- Pide sugerencias a los 7 días de registro (ver check-pilot-feedback-prompt).
-- Corre una vez al día -- la ventana de 7-8 días en la propia función hace
-- que cada usuario caiga en ella una sola vez, no hace falta evitar
-- duplicados acá.
select cron.schedule(
  'check-pilot-feedback-prompt-daily',
  '30 13 * * *',
  $$
  select net.http_post(
    url := 'https://logsjwjvberfsqjfqwob.supabase.co/functions/v1/check-pilot-feedback-prompt',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
