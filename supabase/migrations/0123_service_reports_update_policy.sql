-- FIX CRÍTICO: service_reports nunca tuvo policy de UPDATE (0064 solo creó
-- select/insert/delete). Sin ella, RLS bloqueaba en silencio cualquier
-- update -- que es justo lo que hacen upsertDraft() y createServiceReport()
-- en services/serviceReports.ts cuando el informe ya existía como borrador
-- (draftId seteado): guardar un borrador una segunda vez, o finalizar un
-- borrador ya guardado, fallaba con "No se pudo guardar el borrador."/
-- "No se pudo crear el informe."
create policy service_reports_update_staff on service_reports for update
  using (is_business_staff(business_id))
  with check (is_business_staff(business_id));
