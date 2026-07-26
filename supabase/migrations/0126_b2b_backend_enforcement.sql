-- FIX IMPORTANTE: la regla B2B (taller le compra a tienda; tienda también
-- le compra a otra tienda; nadie le compra a taller -- ver
-- B2B_ALLOWED_SELLER_TYPES en services/businesses.ts) solo se validaba en
-- el frontend (producto/[id].tsx, buscar.tsx). product_intents_insert_client
-- solo exigía client_id = auth.uid(), así que un negocio podía llamar
-- createProductIntent directo contra el producto de OTRO taller y el
-- insert pasaba sin problema.
--
-- Un usuario con role = 'business' en este proyecto solo compra en el
-- flujo B2B (nunca usa las pantallas de cliente/consumidor final, que
-- están separadas por rol) -- así que basta con: si quien compra es dueño
-- o empleado de un negocio, el vendedor tiene que ser tipo 'store'. Un
-- cliente normal (role = 'client') sigue sin restricción, como hoy.

create or replace function get_my_business_type()
returns text
language sql
security definer
stable
as $$
  select business_type::text from businesses where owner_id = auth.uid()
  union
  select b.business_type::text
  from business_employees be
  join businesses b on b.id = be.business_id
  where be.user_id = auth.uid()
  limit 1;
$$;

create or replace function product_intent_b2b_allowed(target_business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select case
    when get_my_business_type() is null then true
    else exists (
      select 1 from businesses seller
      where seller.id = target_business_id and seller.business_type = 'store'
    )
  end;
$$;

drop policy if exists product_intents_insert_client on product_intents;
create policy product_intents_insert_client on product_intents for insert
  with check (client_id = auth.uid() and product_intent_b2b_allowed(business_id));
