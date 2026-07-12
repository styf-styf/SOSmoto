-- Cargo/puesto descriptivo del miembro del equipo (ej. "Mecánico",
-- "Administrador", "Secretaria" en un taller; "Recepcionista", "Bodega" en
-- una tienda). Es solo texto libre e informativo -- no afecta permisos, que
-- se manejan por separado en las columnas can_* de 0092_employee_permissions.
alter table business_employees
  add column job_title text;

alter table employee_invitations
  add column job_title text;

drop function if exists public.get_business_employees(uuid);

create function public.get_business_employees(target_business_id uuid)
returns table (
  id uuid,
  business_id uuid,
  user_id uuid,
  role employee_role,
  job_title text,
  can_accept_aid_requests boolean,
  can_manage_catalog boolean,
  can_reply_chat boolean,
  can_upload_stories boolean,
  can_create_posts boolean,
  created_at timestamptz,
  full_name text,
  email text,
  phone text
)
language sql
security definer
stable
as $$
  select be.id, be.business_id, be.user_id, be.role, be.job_title,
         be.can_accept_aid_requests, be.can_manage_catalog, be.can_reply_chat,
         be.can_upload_stories, be.can_create_posts,
         be.created_at, u.full_name, u.email, u.phone
  from business_employees be
  join users u on u.id = be.user_id
  where be.business_id = target_business_id
    and is_business_staff(target_business_id);
$$;

grant execute on function public.get_business_employees(uuid) to authenticated;
