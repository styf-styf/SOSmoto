-- Comportamiento deseado al bajar de plan: todo lo existente (productos,
-- servicios, fotos, precios por volumen) sigue funcionando y editable con
-- normalidad -- solo se bloquea CRECER más allá del límite del plan actual
-- (agregar un producto/servicio/foto/escalón de precio nuevo, o reactivar
-- uno desactivado). Nunca se bloquea editar o desactivar/eliminar algo que
-- ya existía, aunque el negocio esté por encima del límite tras la baja.
--
-- Arregla dos inconsistencias encontradas:
-- 1. enforce_product_limit/enforce_service_limit (0089) duplicaban a
--    enforce_catalog_limit (0019) pero sin su excepción de "ya estaba
--    activo, no es una nueva activación" -- bloqueaban también editar un
--    producto/servicio activo ya existente (ej. cambiar solo una foto).
--    Se eliminan por completo, dejando solo la versión correcta de
--    0019/0100 (products_enforce_limit / services_enforce_limit).
-- 2. enforce_photo_limit (0115/0120) y enforce_price_tier_limit (0119)
--    revalidaban new.photos/new.price_tiers en cada UPDATE sin importar si
--    esos campos cambiaron -- cualquier edición no relacionada en un
--    producto ya sobre el límite de fotos/escalones quedaba bloqueada. Se
--    reescriben para solo bloquear cuando la cantidad de fotos/escalones
--    aumenta respecto a lo que ya tenía la fila.

drop trigger if exists enforce_product_limit_trigger on products;
drop trigger if exists enforce_service_limit_trigger on services;
drop function if exists enforce_product_limit();
drop function if exists enforce_service_limit();

create or replace function enforce_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_plan text;
  v_new_count int;
  v_old_count int;
  v_noun text;
begin
  select sp.max_photos_per_item, sp.name into v_max, v_plan
  from businesses b join subscription_plans sp on sp.id = b.plan_id
  where b.id = new.business_id;

  if v_max is null then
    return new;
  end if;

  v_new_count := coalesce(array_length(new.photos, 1), 0);
  v_old_count := case when TG_OP = 'INSERT' then 0 else coalesce(array_length(old.photos, 1), 0) end;

  -- Solo bloquea si esta escritura agrega fotos por encima de las que ya
  -- tenía -- editar otro campo sin tocar fotos, o quitar fotos, nunca
  -- bloquea aunque el negocio siga sobre el límite de su plan.
  if v_new_count > v_old_count and v_new_count > v_max then
    v_noun := case when TG_TABLE_NAME = 'posts' then 'publicación' else 'producto/servicio' end;
    raise exception 'Tu plan % permite hasta % foto% por %. Sube de plan para agregar más.',
      v_plan, v_max, (case when v_max = 1 then '' else 's' end), v_noun;
  end if;

  return new;
end;
$$;

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
  v_new_count int;
  v_old_count int;
begin
  v_new_count := coalesce(jsonb_array_length(new.price_tiers), 0);
  v_old_count := case when TG_OP = 'INSERT' then 0 else coalesce(jsonb_array_length(old.price_tiers), 0) end;

  -- Solo bloquea si esta escritura agrega escalones nuevos -- editar otro
  -- campo sin tocar price_tiers, o quitar escalones, nunca bloquea.
  if v_new_count <= v_old_count then
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
