-- FIX IMPORTANTE: nada en el backend impedía que una tienda insertara un
-- `service` directo por API -- solo estaba bloqueado en el frontend
-- (canHaveServices en catalogo.tsx). Se separa services_staff_write ("for
-- all") en policies puntuales para poder exigir is_workshop_business solo
-- en el insert (select ya es público vía services_select_public, así que
-- no hace falta tocarlo).
drop policy if exists services_staff_write on services;

create policy services_staff_update on services for update
  using (is_business_staff(business_id) and not is_business_limited(business_id))
  with check (is_business_staff(business_id) and not is_business_limited(business_id));

create policy services_staff_delete on services for delete
  using (is_business_staff(business_id) and not is_business_limited(business_id));

create policy services_staff_insert on services for insert
  with check (
    is_business_staff(business_id)
    and not is_business_limited(business_id)
    and is_workshop_business(business_id)
  );
