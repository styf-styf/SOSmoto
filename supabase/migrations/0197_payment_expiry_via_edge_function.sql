-- payphone-confirm recibe el `id` numérico de transacción de Payphone en
-- cada llamada pero nunca lo guardaba -- sin persistirlo no hay forma de
-- volver a preguntarle a Payphone más tarde si un pago realmente se
-- procesó. Se guarda apenas se recibe (antes de intentar confirmar), para
-- no perderlo si la llamada a Payphone falla.
alter table payments add column payphone_transaction_id text;

-- Reemplaza el cron SQL puro de 0195 (marcaba 'failed' solo por antigüedad,
-- sin verificar nada) por uno que llama a una Edge Function -- verificar con
-- Payphone antes de cancelar requiere una llamada HTTP real, que un UPDATE
-- de SQL no puede hacer. cron.schedule() actualiza el job existente por
-- nombre (mismo patrón que 0104), no crea uno duplicado.
select cron.schedule(
  'expire-stale-pending-payments',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://logsjwjvberfsqjfqwob.supabase.co/functions/v1/expire-stale-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
