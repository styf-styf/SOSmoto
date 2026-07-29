-- Serie de correcciones de una auditoría de seguridad completa (RLS +
-- validación server-side). Cada bloque documenta el hueco original y el
-- porqué del fix -- ver mensajes de la auditoría para el detalle completo.

-- =====================================================================
-- 1) payphone_webhook_logs sin RLS -- única tabla del proyecto sin
--    `enable row level security`. Cualquiera con la anon key podía leer
--    (y probablemente escribir) todos los webhooks de pago jamás
--    recibidos vía PostgREST. Solo el service role (Edge Functions /
--    web/api/payphone-return.js con la service key) necesita tocar esta
--    tabla -- no hace falta ninguna policy para anon/authenticated.
-- =====================================================================
alter table payphone_webhook_logs enable row level security;

-- =====================================================================
-- 2) business_clients -- un negocio podía auto-otorgarse acceso a los
--    datos de un cliente de la app sin su consentimiento:
--    - INSERT no obligaba status='pending' para clientes de la app.
--    - UPDATE (business_clients_staff_update) no tenía WITH CHECK, así
--      que el negocio podía poner status='accepted' él mismo.
--    - Además, nunca existió una policy que permitiera al CLIENTE ver o
--      responder su propia invitación (getPendingInvitations/
--      respondToInvitation en services/businessClients.ts llaman
--      directo a la tabla con la sesión del cliente) -- el flujo de
--      aceptar/rechazar invitaciones parece haber estado roto por RLS
--      desde que existe. Este fix agrega esa policy que faltaba de paso.
-- =====================================================================
drop policy if exists business_clients_staff_select on business_clients;
drop policy if exists business_clients_staff_insert on business_clients;
drop policy if exists business_clients_staff_update on business_clients;
drop policy if exists business_clients_staff_delete on business_clients;

create policy business_clients_select on business_clients
  for select using (
    is_business_staff(business_id)
    or is_admin()
    or (client_id is not null and client_id = auth.uid())
  );

-- El negocio solo puede insertar una relación con un cliente de la app en
-- estado 'pending' -- nunca puede insertarla ya 'accepted'. Clientes
-- externos (client_id null) no tienen invitación que aceptar, así que su
-- status queda libre (no hay fila en `users` que proteger).
create policy business_clients_insert on business_clients
  for insert with check (
    is_business_staff(business_id)
    and (client_id is null or status = 'pending')
  );

create policy business_clients_update on business_clients
  for update using (
    is_business_staff(business_id)
    or (client_id is not null and client_id = auth.uid())
  );

create policy business_clients_delete on business_clients
  for delete using (
    is_business_staff(business_id)
    or is_admin()
    or (client_id is not null and client_id = auth.uid())
  );

-- RLS no permite comparar OLD vs NEW columna por columna en una sola
-- policy (mismo motivo que 0088) -- un trigger BEFORE UPDATE reparte qué
-- puede tocar cada actor: el cliente dueño de la invitación solo puede
-- mover su propio `status` (aceptar); el negocio puede editar notas/
-- vehículos/datos externos pero nunca el status de una relación con un
-- cliente de la app (eso es responsabilidad exclusiva del cliente).
create or replace function protect_business_clients_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if new.client_id is not null and new.client_id = auth.uid() then
    -- El cliente solo puede cambiar su propio status; todo lo demás
    -- (lo gestiona el negocio) vuelve a su valor anterior.
    new.business_id := old.business_id;
    new.client_id := old.client_id;
    new.external_name := old.external_name;
    new.external_phone := old.external_phone;
    new.external_email := old.external_email;
    new.vehicles := old.vehicles;
    new.notes := old.notes;
    new.created_at := old.created_at;
  elsif is_business_staff(new.business_id) then
    -- El negocio nunca puede auto-aprobar (ni auto-rechazar) una relación
    -- con un cliente de la app -- eso rompe el requisito de consentimiento.
    if new.client_id is not null then
      new.status := old.status;
    end if;
  else
    new := old;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_business_clients_columns on business_clients;
create trigger protect_business_clients_columns
before update on business_clients
for each row execute function protect_business_clients_columns();

-- =====================================================================
-- 3) Empleado invitado podía auto-otorgarse permisos que el dueño nunca
--    le dio: la policy de insert de aceptar invitación
--    (business_employees_accept_invitation, 0132) solo verificaba que
--    existiera una invitación pendiente para ese usuario -- nunca
--    comparaba los permisos (can_*) que el dueño puso en la invitación
--    contra los que el invitado realmente inserta en su propia fila.
-- =====================================================================
drop policy if exists business_employees_accept_invitation on business_employees;
create policy business_employees_accept_invitation on business_employees for insert
  with check (
    user_id = auth.uid()
    and role = 'mechanic'
    and exists (
      select 1 from employee_invitations ei
      where ei.business_id = business_employees.business_id
        and ei.invitee_id = auth.uid()
        and ei.status = 'pending'
        and ei.expires_at > now()
        and ei.can_accept_aid_requests = business_employees.can_accept_aid_requests
        and ei.can_manage_catalog = business_employees.can_manage_catalog
        and ei.can_reply_chat = business_employees.can_reply_chat
        and ei.can_upload_stories = business_employees.can_upload_stories
        and ei.can_create_posts = business_employees.can_create_posts
        and coalesce(ei.job_title, '') = coalesce(business_employees.job_title, '')
    )
  );

-- El invitado también podía reescribir su propia invitación pendiente
-- (inv_update, 0056, sin WITH CHECK) antes de aceptarla -- por ejemplo
-- subiéndose los can_* ahí mismo. Ya no importa tanto tras el fix de
-- arriba (el insert vuelve a comparar contra la invitación), pero se
-- cierra igual por defensa en profundidad: el invitado solo puede mover
-- `status` (aceptar/rechazar), nada más.
create or replace function protect_employee_invitations_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  if new.invitee_id = auth.uid() then
    new.business_id := old.business_id;
    new.invitee_id := old.invitee_id;
    new.can_accept_aid_requests := old.can_accept_aid_requests;
    new.can_manage_catalog := old.can_manage_catalog;
    new.can_reply_chat := old.can_reply_chat;
    new.can_upload_stories := old.can_upload_stories;
    new.can_create_posts := old.can_create_posts;
    new.job_title := old.job_title;
    new.expires_at := old.expires_at;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_employee_invitations_columns on employee_invitations;
create trigger protect_employee_invitations_columns
before update on employee_invitations
for each row execute function protect_employee_invitations_columns();

-- =====================================================================
-- 4) messages_update_read (0008) no tenía WITH CHECK -- cualquiera de
--    las dos partes de un chat podía reescribir el body/image_url/
--    sender_id de un mensaje pasado (pensado solo para marcar `read_at`).
-- =====================================================================
create or replace function protect_message_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  new.client_id := old.client_id;
  new.business_id := old.business_id;
  new.sender_id := old.sender_id;
  new.body := old.body;
  new.image_url := old.image_url;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists protect_message_columns on messages;
create trigger protect_message_columns
before update on messages
for each row execute function protect_message_columns();

-- =====================================================================
-- 5) notifications_insert_any (0108) es `with check (true)` -- cualquier
--    usuario autenticado puede insertar una notificación para CUALQUIER
--    otro usuario (spam/phishing en su bandeja). No se puede restringir
--    a una relación estricta sin romper flujos legítimos reales: hay 14+
--    puntos del código (mensajes, auxilio, citas, reseñas, informes de
--    servicio, invitaciones de empleado, recordatorios de mantenimiento,
--    "apartados" de producto/servicio...) donde un usuario notifica a
--    otro con el que sí tiene una relación real, pero de formas distintas
--    entre sí. Mitigación proporcional mientras tanto: se agrega
--    trazabilidad (created_by) para poder auditar/banear abuso si
--    ocurre -- un bloqueo relacional completo queda para una migración
--    aparte, igual que 0129 dejó pendiente el hueco de email/teléfono.
-- =====================================================================
alter table notifications
  add column if not exists created_by uuid references users(id);

alter table notifications
  alter column created_by set default auth.uid();

drop policy if exists notifications_insert_any on notifications;
create policy notifications_insert_authenticated on notifications
  for insert to authenticated with check (created_by = auth.uid() or auth.role() = 'service_role');

-- =====================================================================
-- 6) impressions/clicks de `ads` eran visibles para cualquiera vía
--    ads_select_active (0002) -- la policy es a nivel de fila, no de
--    columna, así que cualquier negocio (o competidor) podía leer las
--    métricas de rendimiento de una campaña ajena. Se revoca el grant de
--    columna sobre esas dos columnas y se expone el agregado solo al
--    dueño/admin vía una función SECURITY DEFINER (mismo patrón que
--    get_pending_client_names).
-- =====================================================================
revoke select (impressions, clicks) on ads from authenticated, anon;

create or replace function get_business_ad_metrics(target_business_id uuid)
returns table (total_impressions bigint, total_clicks bigint)
language sql
security definer
stable
as $$
  select
    coalesce(sum(impressions), 0)::bigint,
    coalesce(sum(clicks), 0)::bigint
  from ads
  where business_id = target_business_id
    and (is_business_staff(target_business_id) or is_admin());
$$;

grant execute on function get_business_ad_metrics(uuid) to authenticated;
