-- Segundo paso del fix de `businesses` -- funciones que reemplazan los
-- lugares donde el código cliente necesita `owner_id` sin ser dueño/staff
-- del negocio (nunca para MOSTRARLO, solo para saber a quién llamar
-- notifyUser() o para resolver identidad B2B de alguien ya conocido). Se
-- aplican solas primero (aditivo, no rompen nada todavía) -- la policy de
-- la tabla base se restringe en una migración aparte, después de que el
-- código cliente ya esté migrado a usar estas funciones.

-- "Notificar al dueño": ~13 call sites (reseñas, citas, apartados,
-- informes de servicio, mensajes, auxilio, invitaciones de empleado)
-- necesitan resolver el owner_id de un negocio para pasarlo a notifyUser().
-- Reusa can_notify_user (0154) en vez de duplicar la lógica de relación --
-- si ya existe una relación real entre quien llama y el DUEÑO de ese
-- negocio (o quien llama es staff de ese negocio), se resuelve; si no, null.
create or replace function get_business_owner_for_notify(target_business_id uuid)
returns uuid
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result uuid;
begin
  select owner_id into result from businesses where id = target_business_id;
  if result is null then
    return null;
  end if;
  if can_notify_user(result) then
    return result;
  end if;
  return null;
end;
$$;

-- "¿Alguno de estos usuarios que ya conozco es TAMBIÉN dueño de un
-- negocio?" -- usado para resolver identidad B2B (ej. un cliente de chat
-- que resulta ser dueño de otro negocio, o el comprador de un "apartado").
-- Nunca permite DESCUBRIR un owner_id nuevo -- el llamador ya tiene la
-- lista de ids candidatos (de una conversación, compra, etc.), esto solo
-- confirma cuáles de ESOS ids específicos son dueños y su nombre/logo
-- (ya públicos igual vía businesses_public). No hace falta ninguna
-- relación adicional -- name/logo_url de un negocio ya son públicos, esto
-- solo evita exponer la columna owner_id en crudo a través de la tabla.
create or replace function resolve_owned_businesses(target_ids uuid[])
returns table (owner_id uuid, name text, logo_url text)
language sql
security definer
stable
set search_path = public
as $$
  select b.owner_id, b.name, b.logo_url
  from businesses b
  where b.owner_id = any(target_ids);
$$;
