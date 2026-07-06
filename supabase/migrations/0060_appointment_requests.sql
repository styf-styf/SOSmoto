-- Solicitudes de cita pendientes de aceptación por el taller.
-- Se crea cuando el cliente pulsa "Solicitar cita"; el appointment
-- real solo se crea cuando el taller acepta con fecha confirmada.

create table appointment_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete set null,
  service_name text,
  vehicle_label text,
  notes text,
  suggested_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now()
);

create index idx_appreq_client on appointment_requests(client_id);
create index idx_appreq_business on appointment_requests(business_id);
create index idx_appreq_status on appointment_requests(status);

alter table appointment_requests enable row level security;

-- El cliente puede ver y gestionar sus propias solicitudes
create policy appreq_client_all on appointment_requests for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

-- El taller puede ver y actualizar (no insertar)
create policy appreq_business_select on appointment_requests for select
  using (is_business_staff(business_id));

create policy appreq_business_update on appointment_requests for update
  using (is_business_staff(business_id));

alter publication supabase_realtime add table appointment_requests;
