-- Permisos granulares por empleado, mismo patrón que can_accept_aid_requests.
-- can_manage_catalog / can_reply_chat arrancan en true porque hoy catálogo y
-- chat ya son de acceso libre para cualquier miembro del equipo -- el default
-- preserva ese comportamiento y el dueño puede restringirlo hacia adelante.
-- can_upload_stories / can_create_posts arrancan en false porque hoy esas
-- acciones son exclusivas del dueño -- el dueño las habilita por persona.
alter table business_employees
  add column can_manage_catalog boolean not null default true,
  add column can_reply_chat boolean not null default true,
  add column can_upload_stories boolean not null default false,
  add column can_create_posts boolean not null default false;

alter table employee_invitations
  add column can_manage_catalog boolean not null default true,
  add column can_reply_chat boolean not null default true,
  add column can_upload_stories boolean not null default false,
  add column can_create_posts boolean not null default false;

drop function if exists public.get_business_employees(uuid);

create function public.get_business_employees(target_business_id uuid)
returns table (
  id uuid,
  business_id uuid,
  user_id uuid,
  role employee_role,
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
  select be.id, be.business_id, be.user_id, be.role, be.can_accept_aid_requests,
         be.can_manage_catalog, be.can_reply_chat, be.can_upload_stories, be.can_create_posts,
         be.created_at, u.full_name, u.email, u.phone
  from business_employees be
  join users u on u.id = be.user_id
  where be.business_id = target_business_id
    and is_business_staff(target_business_id);
$$;

grant execute on function public.get_business_employees(uuid) to authenticated;
