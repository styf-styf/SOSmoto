-- Cierre del hallazgo de exposición pública de `businesses` (auditoría de
-- agosto, el más grande de los 3, investigado y migrado en esta sesión):
-- businesses_select_public (0002/0027/0039) es `using (true)` -- cualquiera
-- con la anon key podía leer phone, owner_id y limitation_reason de
-- CUALQUIER negocio, sin ninguna relación real.
--
-- Todo el código cliente (app/, services/, components/) ya se migró a leer
-- de `businesses_public` (vista sin esas 3 columnas + is_limited/limited_by/
-- limited_at/promotion_claimed_at, ver migración 0157) para cualquier
-- contexto público, y a resolver owner_id bajo demanda vía funciones
-- SECURITY DEFINER (get_business_owner_for_notify/for_chat,
-- resolve_owned_businesses, get_business_phone_for_client -- 0158/0159/0160/
-- 0161) para los casos legítimos que sí lo necesitan (notificar al dueño,
-- abrir un chat B2B, llamar al taller durante un auxilio activo). Los joins
-- embebidos de otras tablas (posts, ads, stories, appointments, catalog)
-- también se repuntaron a businesses_public -- confirmado empíricamente que
-- PostgREST resuelve el embed contra una vista usando el mismo hint de FK
-- de la tabla base.
--
-- Ahora se restringe la tabla base a solo quien de verdad la necesita
-- completa: dueño/staff del propio negocio (mismo criterio que ya usa
-- businesses_update_staff desde 0002), admin, o service_role (edge
-- functions/admin panel, que de todos modos ya bypasean RLS).
drop policy if exists businesses_select_public on businesses;
create policy businesses_select_staff on businesses for select
  using (is_business_staff(id) or is_admin() or auth.role() = 'service_role');
