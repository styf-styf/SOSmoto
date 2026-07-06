-- Relación explícita taller ↔ cliente (app o externo)
-- Permite al taller agregar clientes aunque no tengan citas aún.
create table business_clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  -- Cliente de la app
  client_id uuid references users(id) on delete cascade,
  -- Cliente externo
  external_name text,
  external_phone text,
  external_email text,
  -- Vehículos del cliente externo [{brand, model, year, plate?}]
  vehicles jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  constraint business_clients_owner_check check (
    (client_id is not null and external_name is null) or
    (client_id is null and external_name is not null)
  )
);

-- Un cliente de la app solo puede estar una vez por negocio
create unique index business_clients_app_unique
  on business_clients(business_id, client_id)
  where client_id is not null;

-- Un cliente externo solo puede estar una vez por negocio (por nombre, sin importar mayúsculas)
create unique index business_clients_ext_unique
  on business_clients(business_id, lower(external_name))
  where client_id is null;

create index business_clients_business_idx on business_clients(business_id);

alter table business_clients enable row level security;

create policy business_clients_staff_select on business_clients
  for select using (is_business_staff(business_id) or is_admin());

create policy business_clients_staff_insert on business_clients
  for insert with check (is_business_staff(business_id));

create policy business_clients_staff_update on business_clients
  for update using (is_business_staff(business_id));

create policy business_clients_staff_delete on business_clients
  for delete using (is_business_staff(business_id) or is_admin());
