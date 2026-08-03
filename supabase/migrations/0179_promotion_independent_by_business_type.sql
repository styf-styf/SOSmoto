-- El usuario pidió que las promociones de taller y tienda sean
-- INDEPENDIENTES entre si (ej. taller Estandar activo + tienda Pro activo al
-- mismo tiempo), con la unica regla de que DENTRO de un mismo business_type
-- solo un nivel (Estandar o Pro) puede estar activo a la vez. La migracion
-- 0149 habia implementado otra cosa (mismo nivel obligatorio entre taller y
-- tienda) -- este cambio reemplaza esa regla.
--
-- De paso se encontraron 2 bugs reales que impedian que esto funcionara aun
-- si el trigger lo permitiera:
--   1. get_active_plan_promotion() y claim_plan_promotion() no filtraban por
--      business_type -- con 2 filas activas a la vez, siempre agarraban
--      "una cualquiera" (limit 1 sin filtro), pudiendo incluso asignarle a
--      una tienda el plan_id de una promocion de taller.
--   2. El endpoint /api/promociones/desactivar (admin) asumia una sola fila
--      activa en toda la tabla (.maybeSingle() sin filtrar por plan_id) --
--      con 2 filas activas simultaneas eso truena.

create or replace function enforce_single_active_promotion_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_business_type text;
  v_conflict boolean;
begin
  if not new.is_active then
    return new;
  end if;

  select business_type into v_new_business_type from subscription_plans where id = new.plan_id;

  select exists (
    select 1
    from plan_promotions pp
    join subscription_plans sp on sp.id = pp.plan_id
    where pp.is_active
      and pp.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and sp.business_type::text = v_new_business_type
  ) into v_conflict;

  if v_conflict then
    raise exception 'Ya hay una promoción activa para este tipo de negocio (Estándar/Pro). Desactívala primero.';
  end if;

  return new;
end;
$$;

drop function if exists public.get_active_plan_promotion();

create function public.get_active_plan_promotion(target_business_type text default null)
returns table (
  id uuid,
  plan_id uuid,
  plan_name text,
  duration_days int,
  activated_at timestamptz,
  applies_to_all_businesses boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select pp.id, pp.plan_id, sp.name, pp.duration_days, pp.activated_at,
         coalesce((select ps.applies_to_all_businesses from promotion_settings ps limit 1), false)
  from plan_promotions pp
  join subscription_plans sp on sp.id = pp.plan_id
  where pp.is_active
    and (target_business_type is null or sp.business_type::text = target_business_type)
  limit 1;
$$;

grant execute on function public.get_active_plan_promotion(text) to authenticated;

create or replace function public.claim_plan_promotion(target_business_id uuid)
returns business_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business businesses%rowtype;
  v_promo plan_promotions%rowtype;
  v_applies_to_all boolean;
  v_now timestamptz := now();
  v_expires_at timestamptz;
  v_new_sub business_subscriptions%rowtype;
begin
  select * into v_business from businesses where id = target_business_id;
  if v_business.id is null then
    raise exception 'Negocio no encontrado';
  end if;
  if v_business.owner_id <> auth.uid() then
    raise exception 'Solo el dueño del negocio puede reclamar la promoción';
  end if;
  if v_business.promotion_claimed_at is not null then
    raise exception 'Este negocio ya reclamó una promoción anteriormente';
  end if;

  select pp.* into v_promo
    from plan_promotions pp
    join subscription_plans sp on sp.id = pp.plan_id
    where pp.is_active and sp.business_type = v_business.business_type
    limit 1;
  if v_promo.id is null then
    raise exception 'No hay ninguna promoción activa para tu tipo de negocio';
  end if;

  select applies_to_all_businesses into v_applies_to_all from promotion_settings limit 1;
  if not coalesce(v_applies_to_all, false) and v_business.created_at < v_promo.activated_at then
    raise exception 'Esta promoción es solo para negocios registrados después de activarse';
  end if;

  v_expires_at := v_now + (v_promo.duration_days || ' days')::interval;

  update business_subscriptions set status = 'expired'
    where business_id = target_business_id and status = 'active';

  insert into business_subscriptions (business_id, plan_id, status, started_at, expires_at, payment_id, promotion_id)
  values (target_business_id, v_promo.plan_id, 'active', v_now, v_expires_at, null, v_promo.id)
  returning * into v_new_sub;

  update businesses set plan_id = v_promo.plan_id, promotion_claimed_at = v_now where id = target_business_id;

  return v_new_sub;
end;
$$;
