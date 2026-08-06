-- Este RPC también inserta en product_intents (ver 0168) -- necesita
-- guardar el mismo snapshot de nombre/precio que 0193 agregó, si no los
-- apartados creados por esta vía se quedarían sin respaldo cuando el
-- producto se borre.
create or replace function create_product_intent_by_business(
  p_client_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity int
)
returns product_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_product_name text;
  v_product_price numeric;
  v_variant_price numeric;
  v_row product_intents;
begin
  select business_id, name, reference_price into v_business_id, v_product_name, v_product_price
  from products where id = p_product_id;
  if v_business_id is null then
    raise exception 'Producto no encontrado';
  end if;
  if not is_business_staff(v_business_id) then
    raise exception 'No autorizado';
  end if;
  if p_quantity < 1 then
    raise exception 'Cantidad inválida';
  end if;

  if p_variant_id is not null then
    select reference_price into v_variant_price from product_variants where id = p_variant_id;
  end if;

  insert into product_intents (client_id, product_id, variant_id, business_id, quantity, status, product_name, product_price)
  values (p_client_id, p_product_id, p_variant_id, v_business_id, p_quantity, 'confirmed', v_product_name, coalesce(v_variant_price, v_product_price))
  returning * into v_row;

  return v_row;
end;
$$;
