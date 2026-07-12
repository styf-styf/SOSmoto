-- Promociones de plan (admin regala Estándar o Pro por tiempo limitado a
-- negocios que se registran mientras la oferta está activa). Cada fila es
-- un periodo histórico de promoción -- activar una nueva NO reescribe la
-- anterior, así los negocios que ya la reclamaron mantienen intacta la
-- referencia a las condiciones (duration_days/activated_at) bajo las que
-- se les otorgó, aunque el admin después cambie o desactive la oferta.
create table plan_promotions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references subscription_plans(id),
  duration_days int not null,
  is_active boolean not null default false,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Solo una promoción puede estar activa a la vez (Estándar O Pro, nunca las dos).
create unique index one_active_plan_promotion on plan_promotions (is_active) where is_active;

alter table businesses
  add column promotion_claimed_at timestamptz;

alter table business_subscriptions
  add column promotion_id uuid references plan_promotions(id);

-- RPC que el propio negocio invoca desde la app para reclamar la promoción
-- activa sin pagar. Hace el mismo trabajo que activateSubscription() en
-- payphone-confirm (expira la suscripción activa, crea la nueva, actualiza
-- businesses.plan_id) pero validando elegibilidad server-side:
--   1. quien llama es el dueño del negocio
--   2. el negocio nunca reclamó una promoción antes (una sola vez, para siempre)
--   3. hay una promoción activa
--   4. el negocio se registró DESPUÉS de que esa promoción se activó
--      (la oferta es solo para altas nuevas, no para negocios ya existentes)
create or replace function public.claim_plan_promotion(target_business_id uuid)
returns business_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business businesses%rowtype;
  v_promo plan_promotions%rowtype;
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
  if v_business.created_at < v_promo.activated_at then
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

grant execute on function public.claim_plan_promotion(uuid) to authenticated;

-- Para que el negocio sepa si hay una promoción activa y si es elegible,
-- sin exponer toda la tabla plan_promotions (RLS de esa tabla queda cerrada
-- a nivel cliente, solo el admin -- vía service role -- y esta función leen).
create or replace function public.get_active_plan_promotion()
returns table (
  id uuid,
  plan_id uuid,
  plan_name text,
  duration_days int,
  activated_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select pp.id, pp.plan_id, sp.name, pp.duration_days, pp.activated_at
  from plan_promotions pp
  join subscription_plans sp on sp.id = pp.plan_id
  where pp.is_active
  limit 1;
$$;

grant execute on function public.get_active_plan_promotion() to authenticated;

alter table plan_promotions enable row level security;
-- Sin policies para 'authenticated' a propósito: el cliente móvil nunca lee
-- esta tabla directo, solo a través de get_active_plan_promotion() (security
-- definer). El admin la gestiona con la service role key, que bypassa RLS.
