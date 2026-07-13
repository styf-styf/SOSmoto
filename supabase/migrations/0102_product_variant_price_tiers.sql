-- Mismo mecanismo de precio por volumen de products.price_tiers (migracion
-- 0101), ahora tambien por variante -- ej. "Talla M: 6 uds a $8.50" puede ser
-- distinto de "Talla L: 6 uds a $9". El escalon base sigue siendo el
-- reference_price de la variante junto con min_order_quantity del producto
-- (las variantes no tienen su propio MOQ, ver getEffectiveUnitPrice).
alter table product_variants add column price_tiers jsonb;
