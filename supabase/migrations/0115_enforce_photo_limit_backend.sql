-- El límite de fotos por producto/servicio (max_photos_per_item) solo se
-- validaba en services/catalog.ts (assertPhotoLimit) -- el único límite de
-- plan sin el mismo trigger que ya protege productos/servicios/empleados
-- (ver 0089_enforce_plan_limits_backend.sql). Una sola función sirve para
-- products y services: ambas tablas tienen photos (text[] not null) y
-- business_id.
create or replace function enforce_photo_limit()
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
  select sp.max_photos_per_item, sp.name into v_max, v_plan
  from businesses b join subscription_plans sp on sp.id = b.plan_id
  where b.id = new.business_id;

  if v_max is null then
    return new;
  end if;

  v_count := coalesce(array_length(new.photos, 1), 0);

  if v_count > v_max then
    raise exception 'Tu plan % permite hasta % foto% por producto/servicio. Sube de plan para agregar más.',
      v_plan, v_max, (case when v_max = 1 then '' else 's' end);
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_photo_limit_products_trigger on products;
create trigger enforce_photo_limit_products_trigger
before insert or update on products
for each row execute function enforce_photo_limit();

drop trigger if exists enforce_photo_limit_services_trigger on services;
create trigger enforce_photo_limit_services_trigger
before insert or update on services
for each row execute function enforce_photo_limit();
