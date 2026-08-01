-- ads.impressions/clicks (hallazgo original de 0142, "6) impressions/clicks
-- de ads eran visibles para cualquiera") nunca se cerró de verdad -- mismo
-- no-op de Postgres que 0155 encontró y corrigió para users.push_token: ya
-- existía un `grant select on ads to authenticated, anon` a nivel de TABLA,
-- así que `revoke select (impressions, clicks) ...` no tuvo ningún efecto
-- real (verificado con pg_attribute.attacl). Cualquier negocio (o cualquiera
-- con la anon key) seguía pudiendo leer el rendimiento de la campaña de un
-- competidor. Bajo severidad real hoy porque ADS_ENABLED=false (no hay
-- campañas activas que espiar), pero se corrige igual ya que se encontró.
--
-- Fix correcto: revocar la tabla completa y re-otorgar columna por columna
-- (excluye impressions, clicks, payment_id y rejection_reason -- las dos
-- últimas son metadata interna/de pago sin ningún consumidor público, ver
-- services/ads.ts). El dueño sigue viendo sus propias métricas y
-- rejection_reason (publicidad.tsx) vía la función de abajo en vez de un
-- select('*') directo, que a partir de ahora falla para cualquier rol
-- autenticado normal, dueño incluido.
revoke select on ads from authenticated, anon;
grant select (
  id, business_id, title, link_url, target_city, status, starts_at, ends_at,
  kind, category_id, item_name, product_id, service_id, photos,
  target_scope, target_lat, target_lng, target_radius_km, link_label,
  created_at, paused_at
) on ads to authenticated, anon;

create or replace function get_business_ads_with_metrics(target_business_id uuid)
returns setof ads
language sql
security definer
stable
set search_path = public
as $$
  select * from ads
  where business_id = target_business_id and is_business_staff(target_business_id)
  order by created_at desc;
$$;
