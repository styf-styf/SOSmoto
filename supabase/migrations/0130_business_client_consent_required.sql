-- FIX CRÍTICO: users_select_for_business_client (0122) daba acceso de
-- lectura a phone/email del cliente en cuanto existía CUALQUIER fila en
-- business_clients para ese client_id -- sin revisar `status`. Como
-- business_clients_staff_insert (0069) deja que un negocio inserte una
-- invitación 'pending' apuntando a cualquier client_id sin relación previa
-- (addAppClient en services/businessClients.ts), el negocio ya tenía acceso
-- completo a los datos del cliente ANTES de que este aceptara o rechazara
-- la invitación -- reabriendo el mismo bug de PII que 0122 cerró, por este
-- camino distinto. El flujo de aceptar/rechazar (respondToInvitation) era
-- puramente cosmético a nivel de datos.
drop policy if exists users_select_for_business_client on users;
create policy users_select_for_business_client on users for select
  using (
    exists (
      select 1 from business_clients bc
      where bc.client_id = users.id
        and bc.status = 'accepted'
        and is_business_staff(bc.business_id)
    )
  );

-- La UI de CRM (clientes.tsx/cliente/[id].tsx) necesita seguir mostrando el
-- NOMBRE de una invitación 'pending' (para que el negocio sepa a quién
-- invitó / pueda cancelar la invitación) -- nunca teléfono/email. Esta
-- función es la única vía para eso: nunca selecciona columnas sensibles,
-- así que es segura de llamar aunque la relación no esté aceptada todavía.
create or replace function get_pending_client_names(target_client_ids uuid[])
returns table (id uuid, full_name text, avatar_url text)
language sql
security definer
stable
as $$
  select distinct u.id, u.full_name, u.avatar_url
  from users u
  join business_clients bc on bc.client_id = u.id
  where u.id = any(target_client_ids)
    and bc.status = 'pending'
    and is_business_staff(bc.business_id);
$$;
