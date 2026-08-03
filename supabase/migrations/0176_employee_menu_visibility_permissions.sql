-- Amplía los toggles de permisos por empleado -- hasta ahora solo
-- controlaban ACCIONES (aceptar auxilios, editar catálogo, responder
-- chat, subir historias, crear publicaciones). Se agregan 7 más para que
-- el dueño decida qué entradas del menú de Configuración ve cada persona
-- de su equipo: Auxilio en carretera, Horario, Agenda, Recordatorios de
-- mantenimiento, Mis compras, Estadísticas y Crece tu negocio. "Catálogo"
-- NO suma un toggle nuevo -- reusa can_manage_catalog, que ya existe (si
-- alguien no puede editar el catálogo, tampoco tiene sentido que vea esa
-- entrada del menú).
--
-- Default true en las 7 -- para que el equipo actual (ya aceptado, sin
-- estos campos) no pierda de golpe acceso a nada que ya veía; el dueño
-- decide después a quién ocultarle qué.
alter table business_employees
  add column can_view_aid_settings boolean not null default true,
  add column can_view_schedule boolean not null default true,
  add column can_view_agenda boolean not null default true,
  add column can_view_maintenance_reminders boolean not null default true,
  add column can_view_purchases boolean not null default true,
  add column can_view_stats boolean not null default true,
  add column can_view_growth boolean not null default true;

alter table employee_invitations
  add column can_view_aid_settings boolean not null default true,
  add column can_view_schedule boolean not null default true,
  add column can_view_agenda boolean not null default true,
  add column can_view_maintenance_reminders boolean not null default true,
  add column can_view_purchases boolean not null default true,
  add column can_view_stats boolean not null default true,
  add column can_view_growth boolean not null default true;

-- get_business_employees (0093): agrega las 7 columnas nuevas al resultado.
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
  can_view_aid_settings boolean,
  can_view_schedule boolean,
  can_view_agenda boolean,
  can_view_maintenance_reminders boolean,
  can_view_purchases boolean,
  can_view_stats boolean,
  can_view_growth boolean,
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
         be.can_view_aid_settings, be.can_view_schedule, be.can_view_agenda,
         be.can_view_maintenance_reminders, be.can_view_purchases,
         be.can_view_stats, be.can_view_growth,
         be.created_at, u.full_name, u.email, u.phone
  from business_employees be
  join users u on u.id = be.user_id
  where be.business_id = target_business_id
    and is_business_staff(target_business_id);
$$;

grant execute on function public.get_business_employees(uuid) to authenticated;

-- business_employees_accept_invitation (0142): compara también las 7
-- columnas nuevas contra la invitación, mismo criterio anti-auto-escalación
-- que ya aplicaba a las 5 originales.
drop policy if exists business_employees_accept_invitation on business_employees;
create policy business_employees_accept_invitation on business_employees for insert
  with check (
    user_id = auth.uid()
    and role = 'mechanic'
    and exists (
      select 1 from employee_invitations ei
      where ei.business_id = business_employees.business_id
        and ei.invitee_id = auth.uid()
        and ei.status = 'pending'
        and ei.expires_at > now()
        and ei.can_accept_aid_requests = business_employees.can_accept_aid_requests
        and ei.can_manage_catalog = business_employees.can_manage_catalog
        and ei.can_reply_chat = business_employees.can_reply_chat
        and ei.can_upload_stories = business_employees.can_upload_stories
        and ei.can_create_posts = business_employees.can_create_posts
        and ei.can_view_aid_settings = business_employees.can_view_aid_settings
        and ei.can_view_schedule = business_employees.can_view_schedule
        and ei.can_view_agenda = business_employees.can_view_agenda
        and ei.can_view_maintenance_reminders = business_employees.can_view_maintenance_reminders
        and ei.can_view_purchases = business_employees.can_view_purchases
        and ei.can_view_stats = business_employees.can_view_stats
        and ei.can_view_growth = business_employees.can_view_growth
        and coalesce(ei.job_title, '') = coalesce(business_employees.job_title, '')
    )
  );

-- protect_employee_invitations_columns (0142): revierte también las 7
-- columnas nuevas si el invitado intenta reescribir su propia invitación
-- pendiente antes de aceptarla.
create or replace function protect_employee_invitations_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() or auth.role() = 'service_role' then
    return new;
  end if;
  if new.invitee_id = auth.uid() then
    new.business_id := old.business_id;
    new.invitee_id := old.invitee_id;
    new.can_accept_aid_requests := old.can_accept_aid_requests;
    new.can_manage_catalog := old.can_manage_catalog;
    new.can_reply_chat := old.can_reply_chat;
    new.can_upload_stories := old.can_upload_stories;
    new.can_create_posts := old.can_create_posts;
    new.can_view_aid_settings := old.can_view_aid_settings;
    new.can_view_schedule := old.can_view_schedule;
    new.can_view_agenda := old.can_view_agenda;
    new.can_view_maintenance_reminders := old.can_view_maintenance_reminders;
    new.can_view_purchases := old.can_view_purchases;
    new.can_view_stats := old.can_view_stats;
    new.can_view_growth := old.can_view_growth;
    new.job_title := old.job_title;
    new.expires_at := old.expires_at;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
