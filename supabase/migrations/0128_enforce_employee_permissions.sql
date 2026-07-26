-- FIX CRÍTICO: los permisos granulares de empleado (can_accept_aid_requests,
-- can_manage_catalog, can_reply_chat, can_upload_stories, can_create_posts,
-- columnas de business_employees desde 0092/0093) nunca se validaban en
-- ninguna policy RLS -- is_business_staff() solo confirma que el usuario
-- pertenece al negocio (dueño o cualquier empleado), nunca revisa estas
-- banderas. El frontend solo ocultaba el botón correspondiente; un mecánico
-- sin ninguno de estos permisos podía aceptar auxilios, gestionar catálogo,
-- mandar mensajes como el negocio, subir historias o publicar posts
-- llamando la API directo.
--
-- El dueño (role = 'owner' en business_employees, o quien no tiene fila ahí
-- porque es el owner_id de businesses) siempre tiene todos los permisos --
-- las banderas granulares solo restringen a empleados no-dueño.

create or replace function can_manage_catalog(target_business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from businesses where id = target_business_id and owner_id = auth.uid())
    or exists (
      select 1 from business_employees
      where business_id = target_business_id and user_id = auth.uid() and can_manage_catalog = true
    );
$$;

create or replace function can_accept_aid(target_business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from businesses where id = target_business_id and owner_id = auth.uid())
    or exists (
      select 1 from business_employees
      where business_id = target_business_id and user_id = auth.uid() and can_accept_aid_requests = true
    );
$$;

create or replace function can_reply_chat(target_business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from businesses where id = target_business_id and owner_id = auth.uid())
    or exists (
      select 1 from business_employees
      where business_id = target_business_id and user_id = auth.uid() and can_reply_chat = true
    );
$$;

create or replace function can_upload_stories(target_business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from businesses where id = target_business_id and owner_id = auth.uid())
    or exists (
      select 1 from business_employees
      where business_id = target_business_id and user_id = auth.uid() and can_upload_stories = true
    );
$$;

create or replace function can_create_posts(target_business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from businesses where id = target_business_id and owner_id = auth.uid())
    or exists (
      select 1 from business_employees
      where business_id = target_business_id and user_id = auth.uid() and can_create_posts = true
    );
$$;

-- Catálogo: servicios (ya divididos en 0125) y productos (todavía "for all").
drop policy if exists services_staff_update on services;
create policy services_staff_update on services for update
  using (is_business_staff(business_id) and not is_business_limited(business_id) and can_manage_catalog(business_id))
  with check (is_business_staff(business_id) and not is_business_limited(business_id) and can_manage_catalog(business_id));

drop policy if exists services_staff_delete on services;
create policy services_staff_delete on services for delete
  using (is_business_staff(business_id) and not is_business_limited(business_id) and can_manage_catalog(business_id));

drop policy if exists services_staff_insert on services;
create policy services_staff_insert on services for insert
  with check (
    is_business_staff(business_id)
    and not is_business_limited(business_id)
    and is_workshop_business(business_id)
    and can_manage_catalog(business_id)
  );

drop policy if exists products_staff_write on products;
create policy products_staff_write on products for all
  using (is_business_staff(business_id) and not is_business_limited(business_id) and can_manage_catalog(business_id))
  with check (is_business_staff(business_id) and not is_business_limited(business_id) and can_manage_catalog(business_id));

-- Auxilio en carretera: ACTUALIZAR (aceptar, completar, cancelar) una
-- solicitud requiere el permiso específico -- se deja aparte de
-- business_notified_for_request (que sigue sin exigirlo) porque esa función
-- también gatea el SELECT: un empleado sin este permiso debe poder seguir
-- VIENDO las solicitudes que le llegan a su negocio (para awareness), solo
-- no puede actuar sobre ellas.
create or replace function public.business_can_manage_help_request(target_help_request_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from help_request_notifications hrn
    where hrn.help_request_id = target_help_request_id
      and is_business_staff(hrn.business_id)
      and can_accept_aid(hrn.business_id)
  );
$$;

drop policy if exists help_requests_business_update on help_requests;
create policy help_requests_business_update on help_requests for update
  using (business_can_manage_help_request(id));

-- Chat: el negocio necesita can_reply_chat además de no estar limitado.
drop policy if exists messages_insert on messages;
create policy messages_insert on messages for insert
  with check (
    sender_id = auth.uid()
    and (
      client_id = auth.uid()
      or (is_business_staff(business_id) and not is_business_limited(business_id) and can_reply_chat(business_id))
    )
  );

-- Historias y posts: mismo criterio, con el permiso específico de cada uno.
drop policy if exists stories_insert_own on stories;
create policy stories_insert_own on stories for insert
  with check (
    (business_id is not null and is_business_staff(business_id) and not is_business_limited(business_id) and can_upload_stories(business_id))
    or (client_id is not null and client_id = auth.uid() and not is_current_user_limited())
  );

drop policy if exists posts_insert_own on posts;
create policy posts_insert_own on posts for insert
  with check (
    (business_id is not null and is_business_staff(business_id) and not is_business_limited(business_id) and can_create_posts(business_id))
    or (client_id is not null and client_id = auth.uid() and not is_current_user_limited())
  );
