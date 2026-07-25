-- Fusiona 'brand_advertiser' en 'store': solo quedan 2 tipos de negocio de
-- cara al usuario (taller y tienda). Las capacidades que hoy son exclusivas
-- de marca (catálogo ilimitado, cantidad mínima de pedido, precio por
-- volumen/escalones) pasan a estar disponibles para cualquier tienda, pero
-- ahora gateadas por PLAN en vez de por tipo de negocio. Los planes de
-- tienda quedan separados de los de taller (mismos 3 nombres, límites
-- distintos) -- taller no se toca en absoluto.
--
-- No se elimina 'brand_advertiser' del enum business_type (borrar un valor
-- de enum en Postgres es una operación arriesgada e innecesaria) -- solo se
-- deja de usar: ningún negocio existente ni nuevo queda con ese valor tras
-- esta migración.

-- 1) subscription_plans pasa a ser por tipo de negocio -----------------

alter table subscription_plans add column business_type business_type not null default 'workshop';
alter table subscription_plans add column allow_variants boolean not null default true;
alter table subscription_plans add column allow_price_tiers boolean not null default true;

alter table subscription_plans drop constraint subscription_plans_name_key;
alter table subscription_plans
  add constraint subscription_plans_name_business_type_key unique (name, business_type);

-- Filas nuevas, exclusivas de tienda. Servicios en 0 -- una tienda nunca
-- crea servicios (solo taller), así que además de bloquearlo en la UI, el
-- trigger enforce_service_limit ya existente también lo bloquea en backend.
insert into subscription_plans
  (name, business_type, max_products, max_services, max_photos_per_item, max_employees,
   max_active_stories, has_priority_matching, has_featured_listing, has_stories,
   price_monthly, allow_variants, allow_price_tiers)
values
  ('free', 'store', 30, 0, 1, 0, 1, false, false, false, 0, false, false),
  ('standard', 'store', 60, 0, 3, 3, 3, false, false, true, 19.99, false, true),
  ('pro', 'store', null, 0, 5, null, 5, true, true, true, 49.99, true, true);

-- 2) Repuntar negocios existentes ---------------------------------------

-- Tiendas reales ya existentes: mismo nombre de plan que tenían, ahora en la
-- fila de tienda (con los límites nuevos, más generosos).
update businesses b
set plan_id = sp_new.id
from subscription_plans sp_old, subscription_plans sp_new
where b.plan_id = sp_old.id
  and b.business_type = 'store'
  and sp_new.name = sp_old.name
  and sp_new.business_type = 'store';

-- Marcas existentes: pasan a tienda con plan Pro (decisión del usuario),
-- conservan su ubicación actual (la corrigen ellas mismas después).
update businesses b
set plan_id = sp_pro.id,
    business_type = 'store'
from subscription_plans sp_pro
where b.business_type = 'brand_advertiser'
  and sp_pro.name = 'pro'
  and sp_pro.business_type = 'store';

-- 3) enforce_product_limit ya no necesita el bypass de marca -------------
-- (el límite correcto ahora sale directo de la fila de plan de tienda).

create or replace function enforce_product_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_plan text;
  v_count int;
begin
  if new.is_active is distinct from true then
    return new;
  end if;

  select sp.max_products, sp.name into v_max, v_plan
  from businesses b join subscription_plans sp on sp.id = b.plan_id
  where b.id = new.business_id;

  if v_max is null then
    return new;
  end if;

  select count(*) into v_count from products
  where business_id = new.business_id and is_active = true
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_max then
    raise exception 'Tu plan % permite hasta % productos activos. Sube de plan para agregar más.', v_plan, v_max;
  end if;

  return new;
end;
$$;

-- 4) Nuevos triggers: variantes y precio por volumen, solo para tienda ---
-- (taller nunca se revisa acá, se mantiene sin restricción como hoy).

create or replace function enforce_variant_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow boolean;
  v_plan text;
  v_business_type business_type;
begin
  select b.business_type, sp.allow_variants, sp.name
    into v_business_type, v_allow, v_plan
  from products p
  join businesses b on b.id = p.business_id
  join subscription_plans sp on sp.id = b.plan_id
  where p.id = new.product_id;

  if v_business_type is distinct from 'store' or coalesce(v_allow, true) then
    return new;
  end if;

  raise exception 'Tu plan % no incluye variantes de producto. Sube de plan para usarlas.', v_plan;
end;
$$;

drop trigger if exists enforce_variant_limit_trigger on product_variants;
create trigger enforce_variant_limit_trigger
before insert on product_variants
for each row execute function enforce_variant_limit();

create or replace function enforce_price_tier_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow boolean;
  v_plan text;
  v_business_type business_type;
  v_business_id uuid;
begin
  if new.price_tiers is null or jsonb_array_length(new.price_tiers) = 0 then
    return new;
  end if;

  if tg_table_name = 'products' then
    v_business_id := new.business_id;
  else
    select p.business_id into v_business_id from products p where p.id = new.product_id;
  end if;

  select b.business_type, sp.allow_price_tiers, sp.name
    into v_business_type, v_allow, v_plan
  from businesses b
  join subscription_plans sp on sp.id = b.plan_id
  where b.id = v_business_id;

  if v_business_type is distinct from 'store' or coalesce(v_allow, true) then
    return new;
  end if;

  raise exception 'Tu plan % no incluye precio por volumen. Sube de plan para usarlo.', v_plan;
end;
$$;

drop trigger if exists enforce_price_tier_limit_products_trigger on products;
create trigger enforce_price_tier_limit_products_trigger
before insert or update on products
for each row execute function enforce_price_tier_limit();

drop trigger if exists enforce_price_tier_limit_variants_trigger on product_variants;
create trigger enforce_price_tier_limit_variants_trigger
before insert or update on product_variants
for each row execute function enforce_price_tier_limit();
