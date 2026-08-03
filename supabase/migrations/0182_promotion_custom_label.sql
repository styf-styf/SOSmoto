-- Permite al admin reemplazar el prefijo "Promoción de lanzamiento:" que ve
-- el negocio en la tarjeta de planes (app/(business)/suscripcion.tsx) --
-- el resto del texto ("{N} días gratis, sin pagar. Solo una vez por
-- negocio.") se mantiene fijo, solo cambia la etiqueta. Si se deja vacío,
-- el cliente usa el texto por defecto.
alter table plan_promotions add column label_text text;

drop function if exists public.get_active_plan_promotion(text);

create function public.get_active_plan_promotion(target_business_type text default null)
returns table (
  id uuid,
  plan_id uuid,
  plan_name text,
  duration_days int,
  activated_at timestamptz,
  applies_to_all_businesses boolean,
  label_text text
)
language sql
security definer
stable
set search_path = public
as $$
  select pp.id, pp.plan_id, sp.name, pp.duration_days, pp.activated_at,
         coalesce((select ps.applies_to_all_businesses from promotion_settings ps limit 1), false),
         pp.label_text
  from plan_promotions pp
  join subscription_plans sp on sp.id = pp.plan_id
  where pp.is_active
    and (target_business_type is null or sp.business_type::text = target_business_type)
  limit 1;
$$;

grant execute on function public.get_active_plan_promotion(text) to authenticated;
