-- Interruptor global (no por plan): si está activado, la promoción activa
-- la puede reclamar CUALQUIER negocio ya registrado, no solo los que se
-- registraron después de activarse. "id boolean primary key default true"
-- + el check es el truco clásico para forzar una tabla de una sola fila.
create table promotion_settings (
  id boolean primary key default true,
  applies_to_all_businesses boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint promotion_settings_singleton check (id)
);
insert into promotion_settings (id, applies_to_all_businesses) values (true, false);

alter table promotion_settings enable row level security;
-- Sin policies para 'authenticated' a propósito, mismo criterio que
-- plan_promotions: el cliente móvil solo la lee vía get_active_plan_promotion()
-- (security definer), y el admin la gestiona con la service role key.

drop function if exists public.get_active_plan_promotion();

create function public.get_active_plan_promotion()
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
  limit 1;
$$;

grant execute on function public.get_active_plan_promotion() to authenticated;

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

  select * into v_promo from plan_promotions where is_active limit 1;
  if v_promo.id is null then
    raise exception 'No hay ninguna promoción activa';
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
