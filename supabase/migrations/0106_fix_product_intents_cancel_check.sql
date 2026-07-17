-- 0098 copió el patrón de service_intents_client_update (with check en
-- status = 'cancelled'), pero product_intents ya había migrado ese estado a
-- 'cancelled_by_client' desde 0079/0080. El valor nunca coincidía, así que
-- Postgres rechazaba por RLS el UPDATE que hace cancelProductIntent()
-- (services/productIntents.ts) -- el cliente veía "No se pudo procesar.
-- Intenta de nuevo." al cancelar un apartado.
drop policy if exists product_intents_update_client on product_intents;

create policy product_intents_update_client on product_intents
  for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and status = 'cancelled_by_client');
