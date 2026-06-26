-- La política users_select_own bloquea que el dueño lea el nombre/correo/teléfono
-- del mecánico vía el join `business_employees(*, users(...))`, porque cada usuario
-- solo puede ver su propia fila. Esta función expone esos datos solo a quien
-- ya es staff del negocio (mismo chequeo que is_business_staff).
create or replace function public.get_business_employees(target_business_id uuid)
returns table (
  id uuid,
  business_id uuid,
  user_id uuid,
  role employee_role,
  can_accept_aid_requests boolean,
  created_at timestamptz,
  full_name text,
  email text,
  phone text
)
language sql
security definer
stable
as $$
  select be.id, be.business_id, be.user_id, be.role, be.can_accept_aid_requests, be.created_at,
         u.full_name, u.email, u.phone
  from business_employees be
  join users u on u.id = be.user_id
  where be.business_id = target_business_id
    and is_business_staff(target_business_id);
$$;

grant execute on function public.get_business_employees(uuid) to authenticated;
