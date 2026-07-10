-- Variantes de producto (ej. tallas de guantes, colores de casco). Cada
-- variante tiene su propio stock y opcionalmente su propio precio -- si
-- reference_price es null, hereda el precio general del producto.
create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  label text not null,
  stock int not null default 0,
  reference_price numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index product_variants_product_id_idx on product_variants(product_id);

alter table product_variants enable row level security;

create policy product_variants_select_public on product_variants for select using (true);
create policy product_variants_staff_write on product_variants for all
  using (is_business_staff((select business_id from products where id = product_variants.product_id)))
  with check (is_business_staff((select business_id from products where id = product_variants.product_id)));

-- product_intents / stock_movements pasan a poder referenciar una variante
-- puntual (nullable -- un producto sin variantes sigue apartándose/moviendo
-- stock igual que antes, con variant_id en null).
alter table product_intents add column variant_id uuid references product_variants(id) on delete set null;
alter table stock_movements add column variant_id uuid references product_variants(id) on delete set null;

-- El "apartar único pendiente" ahora es por variante (o por producto si no
-- tiene variantes) -- así un cliente puede tener apartados pendientes
-- simultáneos de tallas distintas del mismo producto.
drop index if exists product_intents_pending_unique;
create unique index product_intents_pending_unique
  on product_intents(client_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'pending';
