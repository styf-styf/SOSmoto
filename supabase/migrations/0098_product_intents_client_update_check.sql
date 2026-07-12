-- product_intents_update_client no tenia "with check": el cliente podia
-- actualizar su propio intent a CUALQUIER status (confirmed, unavailable,
-- sold via 'confirmed'), no solo cancelarlo -- auto-confirmando una reserva
-- que el negocio nunca aprobo. La tabla gemela service_intents ya tenia el
-- with check correcto desde 0055; esto solo empareja product_intents.
drop policy if exists product_intents_update_client on product_intents;

create policy product_intents_update_client on product_intents
  for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid() and status = 'cancelled');
