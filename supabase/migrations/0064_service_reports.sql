create table service_reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid references users(id) on delete set null,
  appointment_id uuid references appointments(id) on delete set null,
  help_request_id uuid references help_requests(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete set null,
  vehicle_label text,
  external_client_name text,
  services_performed text[] not null default '{}',
  parts_used jsonb,
  observations text,
  recommendations text,
  next_maintenance_km int,
  next_maintenance_date date,
  created_at timestamptz not null default now()
);

create index service_reports_business_id_idx on service_reports(business_id);
create index service_reports_client_id_idx on service_reports(client_id);
create index service_reports_created_at_idx on service_reports(created_at desc);

alter table service_reports enable row level security;

create policy service_reports_select_own on service_reports for select using (
  is_business_staff(business_id)
  or client_id = auth.uid()
  or is_admin()
);

create policy service_reports_insert_staff on service_reports for insert with check (
  is_business_staff(business_id)
);

create policy service_reports_delete_staff_or_admin on service_reports for delete using (
  is_business_staff(business_id) or is_admin()
);
