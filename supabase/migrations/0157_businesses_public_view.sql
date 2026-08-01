-- Primer paso del fix de exposición pública de `businesses` (hallazgo
-- pendiente de la auditoría de agosto): businesses_select_public (0002,
-- redefinida en 0027/0039) es `using (true)` sin restricción de columna --
-- cualquiera con la anon key puede leer phone, owner_id y limitation_reason
-- de cualquier negocio, ninguna de las 3 pensada para ser pública (a
-- diferencia de whatsapp, que sí lo es a propósito).
--
-- Esta migración SOLO crea la vista -- todavía no toca la policy de la
-- tabla base ni ningún call site. Se aplica sola primero para probar si
-- PostgREST permite embeber la vista con el mismo hint de FK que la tabla
-- base (`businesses_public!posts_business_id_fkey(...)`) antes de decidir
-- si los joins embebidos (posts/ads/stories/appointments) necesitan ese
-- cambio mínimo o una reescritura a consulta en dos pasos.
-- Columnas excluidas a propósito: owner_id, phone, is_limited,
-- limitation_reason, limited_by, limited_at, promotion_claimed_at -- todas
-- son o bien dato de contacto privado, o metadata interna de
-- admin/suspensión sin ningún consumidor en pantallas de otros negocios/
-- clientes (verificado: is_limited/limitation_reason solo se leen en
-- pantallas del propio dueño -- datos-negocio.tsx, (tabs)/index.tsx,
-- catalogo.tsx, estado-cuenta.tsx -- nunca en un perfil público).
create view businesses_public
with (security_invoker = false)
as
select
  id, name, description, logo_url, address, city, latitude, longitude,
  whatsapp, schedule, is_verified, rating_avg, followers_count, plan_id,
  aid_radius_km, business_type, is_deactivated, is_available_for_aid,
  is_24h, province, created_at
from businesses;

grant select on businesses_public to authenticated, anon;
