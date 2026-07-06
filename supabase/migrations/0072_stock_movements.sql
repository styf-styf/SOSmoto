create table if not exists stock_movements (
  id         uuid        primary key default gen_random_uuid(),
  product_id uuid        not null references products(id) on delete cascade,
  business_id uuid       not null references businesses(id) on delete cascade,
  delta      integer     not null,
  reason     text        not null check (reason in ('entry', 'sale', 'adjustment', 'damage', 'other')),
  notes      text,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_product_id_idx  on stock_movements(product_id);
create index if not exists stock_movements_business_id_idx on stock_movements(business_id);
create index if not exists stock_movements_created_at_idx  on stock_movements(created_at desc);

alter table stock_movements enable row level security;

create policy stock_movements_staff_all on stock_movements
  for all
  using (is_business_staff(business_id))
  with check (is_business_staff(business_id));
