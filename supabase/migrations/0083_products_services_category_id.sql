-- category_id reemplaza a products.category (texto libre) y se agrega por
-- primera vez a services.
alter table products add column category_id uuid references categories(id);
alter table services add column category_id uuid references categories(id);

-- backfill productos existentes por nombre (case-insensitive), fallback 'Otros'
update products p set category_id = (
  select id from categories c
  where c.kind = 'product' and lower(c.name) = lower(coalesce(p.category, ''))
  limit 1
);
update products set category_id = (select id from categories where kind = 'product' and name = 'Otros')
  where category_id is null;

-- servicios existentes: no había categoría antes, todos a 'Otros'
update services set category_id = (select id from categories where kind = 'service' and name = 'Otros')
  where category_id is null;

alter table products alter column category_id set not null;
alter table services alter column category_id set not null;
alter table products drop column category;
