-- Los 'cancelled' existentes no tienen forma de saber quién canceló;
-- se asumen cancelados por el cliente (comportamiento previo por defecto).
-- Separado en su propia migración porque un valor de enum recién agregado
-- (0079) no se puede usar en la misma transacción en que se agrega.
update product_intents set status = 'cancelled_by_client' where status = 'cancelled';

-- Permite vincular una reseña a una compra de producto específica, igual que
-- ya existe para help_request_id / appointment_id.
alter table reviews add column product_intent_id uuid references product_intents(id);
create index idx_reviews_product_intent_id on reviews(product_intent_id);
