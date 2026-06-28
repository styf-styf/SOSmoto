-- Fix: 0039 recreó policies de business_employees asumiendo el esquema
-- original de 0002 (business_employees_staff_all), pero 0014 ya las había
-- reemplazado por business_employees_select + business_employees_owner_write
-- (solo el dueño, no cualquier staff, puede gestionar empleados). Esa
-- policy "for all" seguía sin el chequeo de is_limited y quedó activa en
-- paralelo a las 4 policies nuevas de 0039 -- como las policies permisivas
-- se combinan con OR, el dueño de un negocio limitado podía seguir
-- gestionando empleados igual. Se reemplaza business_employees_owner_write
-- con el chequeo de límite, y se eliminan las 4 policies redundantes de 0039.
drop policy if exists business_employees_staff_select on business_employees;
drop policy if exists business_employees_staff_insert on business_employees;
drop policy if exists business_employees_staff_update on business_employees;
drop policy if exists business_employees_staff_delete on business_employees;

drop policy if exists business_employees_owner_write on business_employees;
create policy business_employees_owner_write on business_employees for all
  using (is_business_owner(business_id) and not is_business_limited(business_id))
  with check (is_business_owner(business_id) and not is_business_limited(business_id));
