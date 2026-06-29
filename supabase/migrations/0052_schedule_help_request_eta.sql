-- Recalcula el ETA real (por carretera) de los auxilios activos cada 2
-- minutos, mismo patron que check-maintenance-daily (0042). Solo afecta
-- solicitudes con status accepted/in_progress y ubicacion del taller
-- disponible -- el costo de Distance Matrix es ~1 elemento por solicitud
-- activa por corrida, no por taller candidato.
select cron.schedule(
  'update-help-request-eta',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://logsjwjvberfsqjfqwob.supabase.co/functions/v1/update-help-request-eta',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
