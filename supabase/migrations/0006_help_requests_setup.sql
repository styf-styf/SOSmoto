-- El cliente que crea la solicitud de auxilio es quien notifica a los talleres cercanos
-- (no existía política de insert para help_request_notifications).
create policy help_request_notifications_client_insert on help_request_notifications for insert
  with check (
    exists (select 1 from help_requests hr where hr.id = help_request_notifications.help_request_id and hr.client_id = auth.uid())
  );

-- Un negocio necesita ver nombre/teléfono del cliente que le envió una solicitud de auxilio
-- (users_select_own solo permite verse a uno mismo).
create policy users_select_for_active_help_request on users for select
  using (
    exists (
      select 1 from help_requests hr
      join help_request_notifications hrn on hrn.help_request_id = hr.id
      where hr.client_id = users.id and is_business_staff(hrn.business_id)
    )
  );

-- Habilitar Realtime para que el cliente vea en vivo cuando un taller acepta,
-- y el taller vea en vivo nuevas solicitudes.
alter publication supabase_realtime add table help_requests;
alter publication supabase_realtime add table help_request_notifications;
