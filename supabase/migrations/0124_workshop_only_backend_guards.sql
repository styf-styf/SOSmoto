-- FIX IMPORTANTE: las pantallas "solo taller" (auxilio-carretera, agenda,
-- nueva-cita, nuevo-informe, mantenimiento-proactivo) solo estaban
-- protegidas en el frontend. Ni la policy de insert de `appointments` ni la
-- de `service_reports` validaban business_type -- una tienda podía crear
-- citas/informes llamando la API de Supabase directo con su propio JWT,
-- sin pasar por ninguna pantalla bloqueada.

create or replace function is_workshop_business(target_business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from businesses
    where id = target_business_id and business_type = 'workshop'
  );
$$;

-- appointments: separar la policy "for all" del cliente en select/insert/update
-- para poder exigir el check de taller solo en el insert (nunca se usa
-- delete en el código -- las citas se cancelan con un update de status).
drop policy if exists appointments_client_all on appointments;

create policy appointments_client_select on appointments for select
  using (client_id = auth.uid());

create policy appointments_client_insert on appointments for insert
  with check (client_id = auth.uid() and is_workshop_business(business_id));

create policy appointments_client_update on appointments for update
  using (client_id = auth.uid());

drop policy if exists appointments_business_insert on appointments;
create policy appointments_business_insert on appointments for insert
  with check (is_business_staff(business_id) and is_workshop_business(business_id));

drop policy if exists service_reports_insert_staff on service_reports;
create policy service_reports_insert_staff on service_reports for insert with check (
  is_business_staff(business_id) and is_workshop_business(business_id)
);
