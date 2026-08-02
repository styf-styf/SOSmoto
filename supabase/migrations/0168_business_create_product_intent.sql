-- Nuevo banner de cotización en el chat del negocio: al cotizar un producto
-- del catálogo, el negocio puede "Apartar" de inmediato (sin esperar acción
-- del cliente) -- eso crea un product_intent en nombre del cliente, algo
-- que la policy de insert actual NO permite (product_intents_insert_client
-- exige client_id = auth.uid(), correcto para el flujo normal donde el
-- CLIENTE pide el apartado, pero acá es el NEGOCIO iniciando en nombre del
-- cliente). Función puntual, SECURITY DEFINER, gateada por is_business_staff
-- del negocio dueño del producto (resuelto server-side, no confiado del
-- cliente) -- inserta directo en 'confirmed' (no 'pending': no es una
-- solicitud a resolver, ya está decidido por el propio negocio).
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
  v_row product_intents;
begin
  select business_id into v_business_id from products where id = p_product_id;
  if v_business_id is null then
    raise exception 'Producto no encontrado';
  end if;
  if not is_business_staff(v_business_id) then
    raise exception 'No autorizado';
  end if;
  if p_quantity < 1 then
    raise exception 'Cantidad inválida';
  end if;

  insert into product_intents (client_id, product_id, variant_id, business_id, quantity, status)
  values (p_client_id, p_product_id, p_variant_id, v_business_id, p_quantity, 'confirmed')
  returning * into v_row;

  return v_row;
end;
$$;
