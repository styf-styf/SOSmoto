-- country (0200) es pública igual que city/province -- se agrega a la vista
-- businesses_public (0157) para que quede visible en cualquier contexto
-- público (búsqueda, perfil de negocio), no solo en las pantallas del dueño.
create or replace view businesses_public
with (security_invoker = false)
as
select
  id, name, description, logo_url, address, city, latitude, longitude,
  whatsapp, schedule, is_verified, rating_avg, followers_count, plan_id,
  aid_radius_km, business_type, is_deactivated, is_available_for_aid,
  is_24h, province, created_at, country
from businesses;
