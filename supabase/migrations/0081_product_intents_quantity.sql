-- Permite apartar más de 1 unidad de un producto en un solo intent.
alter table product_intents
  add column quantity int not null default 1 check (quantity > 0);
