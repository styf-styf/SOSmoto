create type appointment_status as enum ('pending', 'confirmed', 'rejected', 'cancelled', 'completed');

create table appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id),
  business_id uuid not null references businesses(id),
  vehicle_id uuid references vehicles(id),
  service_id uuid references services(id),
  requested_at timestamptz not null,
  notes text,
  status appointment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index idx_appointments_business_id on appointments(business_id);
create index idx_appointments_client_id on appointments(client_id);

alter table appointments enable row level security;

create policy appointments_client_all on appointments for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

create policy appointments_business_select on appointments for select
  using (is_business_staff(business_id));

create policy appointments_business_update on appointments for update
  using (is_business_staff(business_id));

-- Un negocio necesita ver nombre/teléfono del cliente que le pidió una cita
-- (users_select_own solo permite verse a uno mismo).
create policy users_select_for_appointment on users for select
  using (
    exists (
      select 1 from appointments a
      where a.client_id = users.id and is_business_staff(a.business_id)
    )
  );

alter publication supabase_realtime add table appointments;
