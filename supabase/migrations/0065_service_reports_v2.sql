alter table service_reports
  add column service_category text,
  add column service_km int,
  add column inspection_checklist jsonb,
  add column client_confirmed_at timestamptz;

-- El cliente solo puede confirmar su propio informe (campo único, no puede
-- modificar otros campos — la función valida que solo toque client_confirmed_at).
create or replace function confirm_service_report(report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update service_reports
  set client_confirmed_at = now()
  where id = report_id
    and client_id = auth.uid()
    and client_confirmed_at is null;
end $$;
