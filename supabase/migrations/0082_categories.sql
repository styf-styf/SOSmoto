-- Lista curada de categorías de producto/servicio, administrada por el admin.
-- Un negocio puede "sugerir" una categoría nueva (queda pending, usable de
-- inmediato) que el admin luego revisa/renombra/aprueba.
create type category_kind as enum ('product', 'service');

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind category_kind not null,
  status text not null default 'approved' check (status in ('approved', 'pending')),
  created_at timestamptz not null default now()
);
create unique index categories_name_kind_unique on categories(lower(name), kind);

alter table categories enable row level security;

create policy categories_select_public on categories for select using (true);
create policy categories_admin_write on categories for all using (is_admin()) with check (is_admin());
create policy categories_suggest_pending on categories for insert
  with check (status = 'pending' and auth.uid() is not null);

insert into categories (name, kind) values
  ('Cascos', 'product'), ('Guantes', 'product'), ('Chaquetas y protección', 'product'),
  ('Repuestos', 'product'), ('Aceites y lubricantes', 'product'), ('Llantas', 'product'),
  ('Baterías', 'product'), ('Herramientas', 'product'), ('Accesorios', 'product'), ('Otros', 'product'),
  ('Mantenimiento general', 'service'), ('Cambio de aceite', 'service'), ('Frenos', 'service'),
  ('Suspensión', 'service'), ('Sistema eléctrico', 'service'), ('Llantas y alineación', 'service'),
  ('Diagnóstico', 'service'), ('Personalización', 'service'), ('Otros', 'service');
