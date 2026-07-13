-- Precio por volumen para productos B2B (Marca -> taller/tienda): arreglo de
-- escalones [{min_quantity, unit_price}, ...] ordenado ascendente. El primer
-- escalon siempre coincide con min_order_quantity/reference_price -- el
-- formulario lo arma a partir de esos mismos campos, esto solo guarda
-- escalones ADICIONALES para cantidades mayores (ver services/catalog.ts).
alter table products add column price_tiers jsonb;
