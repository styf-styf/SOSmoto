-- Cantidad minima de pedido (para compras al por mayor de taller/tienda a
-- una marca) -- opcional, no aplica a productos de venta al detalle normal.
alter table products add column min_order_quantity int;

-- El limite de catalogo por plan no tiene sentido para una marca: su
-- "cliente" no es el consumidor final sino talleres/tiendas comprando al
-- por mayor, y una marca real suele tener muchos mas SKUs que un taller o
-- tienda de barrio. Se deja el catalogo de productos sin limite para
-- business_type = 'brand_advertiser', sin importar el plan.
create or replace function enforce_product_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_plan text;
  v_business_type text;
  v_count int;
begin
  if new.is_active is distinct from true then
    return new;
  end if;

  select sp.max_products, sp.name, b.business_type into v_max, v_plan, v_business_type
  from businesses b join subscription_plans sp on sp.id = b.plan_id
  where b.id = new.business_id;

  if v_business_type = 'brand_advertiser' then
    return new;
  end if;

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
