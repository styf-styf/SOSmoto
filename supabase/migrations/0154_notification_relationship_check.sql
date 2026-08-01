-- Tercera tanda de fixes de la auditoría de seguridad de agosto (continúa
-- 0142/0153) -- cierra los 2 hallazgos MEDIA que quedaron deliberadamente
-- diferidos por necesitar mapear con precisión cada flujo legítimo antes de
-- restringir nada (ver project_security_audit_2026_08 en memoria). El
-- tercer hallazgo (exposición de columnas públicas de `businesses`) NO se
-- toca acá -- resultó mucho más grande de lo estimado (40+ call sites en
-- toda la app, incluye joins embebidos de PostgREST que rompen por completo
-- en vez de solo filtrar columnas) y queda para una sesión aparte dedicada.

-- =====================================================================
-- 1) notifications_insert_authenticated (0142) solo exige created_by =
--    auth.uid() -- cualquier usuario autenticado podía insertar una
--    notificación falsa en la bandeja de CUALQUIER otro usuario (vector de
--    phishing, ej. "tu pago falló, toca aquí"). 0142 ya documentó esto como
--    diferido a propósito por la cantidad de flujos legítimos distintos
--    (14+ en ese entonces). Se mapearon TODOS los call sites reales de
--    notifyUser() en código cliente (31 en total) y se construyó una
--    función que cubre exactamente esas relaciones, ni más ni menos:
--      - help_requests: el fan-out al crear (antes de que exista
--        accepted_business_id, se prueba vía help_request_notifications,
--        que siempre se inserta ANTES del notifyUser en
--        services/helpRequests.ts) + el ciclo de vida post-aceptación.
--      - appointment_requests, appointments, product_intents,
--        service_reports, messages: mismo patrón bidireccional
--        (cliente->dueño del negocio, o cualquier staff del negocio->cliente).
--      - reviews: unidireccional, autor de la reseña -> dueño del negocio
--        reseñado (nunca al revés).
--      - business_clients: negocio (staff) -> el cliente de la app que
--        agregó/invitó.
--      - employee_invitations: negocio (staff) <-> invitado, en cualquier
--        dirección (invitar, aceptar, rechazar).
--    No se filtra por status (pending/completed/cancelled/etc.) a propósito
--    -- una vez que existió una relación real entre dos personas, se
--    permite seguir notificándose (ej. recordatorios de mantenimiento a un
--    cliente con un servicio ya completado hace tiempo, que no tiene una
--    fila "activa" en ninguna de estas tablas pero sí tuvo una real).
-- =====================================================================
create or replace function can_notify_user(p_target_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null or p_target_user_id is null then
    return false;
  end if;
  if caller = p_target_user_id then
    return true;
  end if;

  -- help_requests: fan-out al crear, antes de que exista accepted_business_id
  if exists (
    select 1 from help_request_notifications hrn
    join help_requests hr on hr.id = hrn.help_request_id
    join businesses b on b.id = hrn.business_id
    where hr.client_id = caller and b.owner_id = p_target_user_id
  ) then
    return true;
  end if;

  -- help_requests: ciclo de vida post-aceptación, cualquier dirección
  if exists (
    select 1 from help_requests hr
    join businesses b on b.id = hr.accepted_business_id
    where (hr.client_id = caller and b.owner_id = p_target_user_id)
       or (is_business_staff(b.id) and hr.client_id = p_target_user_id)
  ) then
    return true;
  end if;

  -- appointment_requests
  if exists (
    select 1 from appointment_requests ar
    join businesses b on b.id = ar.business_id
    where (ar.client_id = caller and b.owner_id = p_target_user_id)
       or (is_business_staff(b.id) and ar.client_id = p_target_user_id)
  ) then
    return true;
  end if;

  -- appointments
  if exists (
    select 1 from appointments a
    join businesses b on b.id = a.business_id
    where (a.client_id = caller and b.owner_id = p_target_user_id)
       or (is_business_staff(b.id) and a.client_id = p_target_user_id)
  ) then
    return true;
  end if;

  -- product_intents
  if exists (
    select 1 from product_intents pi
    join businesses b on b.id = pi.business_id
    where (pi.client_id = caller and b.owner_id = p_target_user_id)
       or (is_business_staff(b.id) and pi.client_id = p_target_user_id)
  ) then
    return true;
  end if;

  -- service_reports
  if exists (
    select 1 from service_reports sr
    join businesses b on b.id = sr.business_id
    where (sr.client_id = caller and b.owner_id = p_target_user_id)
       or (is_business_staff(b.id) and sr.client_id = p_target_user_id)
  ) then
    return true;
  end if;

  -- messages
  if exists (
    select 1 from messages m
    join businesses b on b.id = m.business_id
    where (m.client_id = caller and b.owner_id = p_target_user_id)
       or (is_business_staff(b.id) and m.client_id = p_target_user_id)
  ) then
    return true;
  end if;

  -- reviews: unidireccional, autor -> dueño del negocio reseñado
  if exists (
    select 1 from reviews r
    join businesses b on b.id = r.reviewed_business_id
    where r.reviewer_id = caller and b.owner_id = p_target_user_id
  ) then
    return true;
  end if;

  -- business_clients: negocio (staff) -> cliente de la app que agregó
  if exists (
    select 1 from business_clients bc
    where bc.client_id = p_target_user_id and is_business_staff(bc.business_id)
  ) then
    return true;
  end if;

  -- employee_invitations: negocio (staff) <-> invitado, cualquier dirección
  if exists (
    select 1 from employee_invitations ei
    join businesses b on b.id = ei.business_id
    where (ei.invitee_id = p_target_user_id and is_business_staff(ei.business_id))
       or (caller = ei.invitee_id and b.owner_id = p_target_user_id)
  ) then
    return true;
  end if;

  return false;
end;
$$;

drop policy if exists notifications_insert_authenticated on notifications;
create policy notifications_insert_authenticated on notifications
  for insert to authenticated
  with check (
    auth.role() = 'service_role'
    or (created_by = auth.uid() and can_notify_user(user_id))
  );

-- =====================================================================
-- 2) push_token expuesto vía cualquier policy de relación real en `users`.
--    Quien sea que ya tuviera acceso de fila a otro usuario (ej. un
--    negocio que tuvo una sola cita con un cliente, alguna vez) también
--    podía leer su push_token en crudo y mandarle una notificación real,
--    indistinguible de una genuina, directo a la API pública de Expo.
--    services/notifications.ts's notifyUser() leía push_token bajo la
--    auth normal del que llama (no service_role) en 31 call sites -- se
--    revoca el acceso de columna y se expone solo vía esta función, que
--    reusa exactamente la misma relación real que ya valida can_notify_user
--    (si no hay relación real, no hay token, no hay push posible).
-- =====================================================================
create or replace function get_push_token_for_notify(p_target_user_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select push_token from users
  where id = p_target_user_id and can_notify_user(p_target_user_id);
$$;

revoke select (push_token) on users from authenticated, anon;
