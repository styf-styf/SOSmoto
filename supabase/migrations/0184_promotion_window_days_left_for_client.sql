-- El negocio necesita ver cuántos días le quedan para reclamar la
-- promoción antes de que se autoapague (window_days/remaining_window_days,
-- agregados en 0180 -- hasta ahora solo se leían en el admin). Se agrega
-- remaining_window_days al retorno de get_active_plan_promotion; el
-- cliente calcula la cuenta regresiva en vivo igual que ya hace el admin
-- (remaining_window_days - dias transcurridos desde activated_at). Null si
-- la promoción no tiene autoapagado configurado (manual-only) -- en ese
-- caso el cliente no muestra contador porque no hay fecha de corte fija.
drop function if exists public.get_active_plan_promotion(text);

create function public.get_active_plan_promotion(target_business_type text default null)
returns table (
  id uuid,
  plan_id uuid,
  plan_name text,
  duration_days int,
  activated_at timestamptz,
  applies_to_all_businesses boolean,
  label_text text,
  remaining_window_days numeric
)
language sql
security definer
stable
set search_path = public
as $$
  select pp.id, pp.plan_id, sp.name, pp.duration_days, pp.activated_at,
         coalesce((select ps.applies_to_all_businesses from promotion_settings ps limit 1), false),
         pp.label_text, pp.remaining_window_days
  from plan_promotions pp
  join subscription_plans sp on sp.id = pp.plan_id
  where pp.is_active
    and (target_business_type is null or sp.business_type::text = target_business_type)
  limit 1;
$$;

grant execute on function public.get_active_plan_promotion(text) to authenticated;
