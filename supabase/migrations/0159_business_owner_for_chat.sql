-- Caso aparte de "resolver owner_id sin exponerlo público": el botón
-- "Mensaje" B2B (un negocio le escribe a otro, ver BusinessProfileView.tsx
-- y AdDetail.tsx) necesita el owner_id del negocio ajeno para armar la ruta
-- del chat (`/(business)/chat/${ownerId}`) -- pero en ese momento, a
-- diferencia de get_business_owner_for_notify, TODAVÍA no existe ninguna
-- relación previa (es el primer click para iniciar la conversación). Se
-- restringe con is_any_business_staff() en vez de exigir una relación --
-- cualquier cuenta de negocio puede resolver el owner_id de OTRO negocio
-- específico para escribirle (acción legítima y esperada del B2B), pero un
-- cliente anónimo o sin cuenta de negocio no puede usar esto para cosechar
-- owner_id de todos los negocios en bloque.
create or replace function get_business_owner_for_chat(target_business_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select owner_id from businesses
  where id = target_business_id and is_any_business_staff();
$$;

-- app/(client)/(tabs)/auxilio.tsx muestra el botón "Llamar" al taller que
-- aceptó la solicitud de auxilio activa del cliente -- `phone` (a
-- diferencia de `whatsapp`, que sí es público) solo debe verse ahí, cuando
-- existe una emergencia real en curso con ESE negocio específico. Reusa
-- can_notify_user (0154), que ya cubre exactamente esa relación
-- (help_requests.accepted_business_id).
create or replace function get_business_phone_for_client(target_business_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select phone from businesses
  where id = target_business_id and can_notify_user(owner_id);
$$;
