-- Hace cumplir en el backend el límite de productos/servicios activos según
-- el plan del negocio (antes solo se validaba en services/catalog.ts, lo
-- cual se podía saltar llamando directo a la API de Supabase).
create or replace function enforce_catalog_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_allowed int;
  plan_name text;
  current_count int;
begin
  -- Solo nos importa cuando la fila queda activa: desactivar nunca rompe el límite.
  if not coalesce(new.is_active, true) then
    return new;
  end if;

  -- Si ya estaba activa antes del update, no es una nueva activación.
  if TG_OP = 'UPDATE' and coalesce(old.is_active, false) = true then
    return new;
  end if;

  if TG_TABLE_NAME = 'products' then
    select sp.max_products, sp.name::text into max_allowed, plan_name
    from businesses b join subscription_plans sp on sp.id = b.plan_id
    where b.id = new.business_id;
  else
    select sp.max_services, sp.name::text into max_allowed, plan_name
    from businesses b join subscription_plans sp on sp.id = b.plan_id
    where b.id = new.business_id;
  end if;

  if max_allowed is null then
    return new;
  end if;

  if TG_TABLE_NAME = 'products' then
    select count(*) into current_count from products
    where business_id = new.business_id and is_active = true and id is distinct from new.id;
  else
    select count(*) into current_count from services
    where business_id = new.business_id and is_active = true and id is distinct from new.id;
  end if;

  if current_count >= max_allowed then
    raise exception 'Límite del plan % alcanzado (% activos permitidos)', plan_name, max_allowed;
  end if;

  return new;
end;
$$;

drop trigger if exists products_enforce_limit on products;
create trigger products_enforce_limit
  before insert or update on products
  for each row execute function enforce_catalog_limit();

drop trigger if exists services_enforce_limit on services;
create trigger services_enforce_limit
  before insert or update on services
  for each row execute function enforce_catalog_limit();
