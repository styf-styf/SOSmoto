-- Mismo problema que appointments (0192), pero peor: product_intents.product_id
-- tenía "on delete cascade" -- borrar un producto no fallaba, simplemente
-- borraba en SILENCIO todos los apartados de ese producto, incluidos los ya
-- vendidos ("sold"). Se pierde el historial de ventas sin ningún aviso.
alter table product_intents add column product_name text;
alter table product_intents add column product_price numeric;
alter table product_intents alter column product_id drop not null;

-- Backfill: nombre y precio del producto tal como están hoy (usa el precio
-- de la variante si el intent tiene una, si no el del producto -- mismo
-- criterio base que intentUnitPrice() en services/productIntents.ts, sin
-- los escalones por cantidad, que no aplican a un snapshot histórico).
update product_intents pi
set product_name = p.name,
    product_price = coalesce(
      (select v.reference_price from product_variants v where v.id = pi.variant_id),
      p.reference_price
    )
from products p
where pi.product_id = p.id and pi.product_name is null;

-- Mismo patrón que product_intents_variant_id_fkey (ya "on delete set
-- null"): ahora borrar el producto SÍ funciona -- el apartado/venta
-- sobrevive con su snapshot como respaldo para mostrar.
alter table product_intents drop constraint product_intents_product_id_fkey;
alter table product_intents add constraint product_intents_product_id_fkey
  foreign key (product_id) references products(id) on delete set null;
