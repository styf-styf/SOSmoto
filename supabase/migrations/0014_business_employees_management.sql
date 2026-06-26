-- Restringe la escritura de business_employees solo al dueño del negocio.
-- Antes, cualquier staff (incluyendo mecánicos) podía agregar/quitar/editar
-- a otros empleados, lo cual no tiene sentido al construir la gestión de equipo.

create or replace function public.is_business_owner(target_business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from businesses where id = target_business_id and owner_id = auth.uid()
  );
$$;

drop policy if exists business_employees_staff_all on business_employees;

create policy business_employees_select on business_employees for select
  using (is_business_staff(business_id));

create policy business_employees_owner_write on business_employees for all
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

-- Permite resolver el id de un usuario a partir de su email, para que el dueño
-- pueda agregarlo como empleado sin que la tabla users quede expuesta por RLS.
create or replace function public.find_user_id_by_email(target_email text)
returns uuid
language sql
security definer
stable
as $$
  select id from users where email = target_email limit 1;
$$;

grant execute on function public.find_user_id_by_email(text) to authenticated;
