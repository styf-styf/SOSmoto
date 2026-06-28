-- "Limitar" reemplaza al "Suspender" anterior (que baneaba el login vía
-- GoTrue y ocultaba al negocio de la búsqueda pública). Una cuenta limitada
-- sigue viéndose y usándose con normalidad -- incluido el auxilio en
-- carretera (pedir/recibir/aceptar, nunca se restringe) -- pero se le
-- bloquean acciones puntuales de creación/gestión, decididas explícitamente
-- por el usuario:
--   Cliente limitado: no puede crear publicaciones, subir historias, ni
--     buscar talleres (este último solo se aplica a nivel de UI -- ver
--     app/(client)/(tabs)/buscar.tsx -- porque la lectura de `businesses` es
--     la misma tabla pública que ya se usa para ver perfiles/feed, no tiene
--     sentido bloquearla a nivel de fila sin romper el resto de la app).
--   Negocio limitado: no puede crear anuncios nuevos, subir historias, crear
--     publicaciones, editar catálogo, ni gestionar empleados/chat. Sigue
--     recibiendo y aceptando solicitudes de auxilio, y la agenda de citas no
--     se toca.
alter table users rename column is_suspended to is_limited;
alter table businesses rename column is_suspended to is_limited;
alter table users add column limitation_reason text;
alter table businesses add column limitation_reason text;

-- Ya no se oculta de la búsqueda pública -- "limitar" no implica invisible.
drop policy if exists businesses_select_public on businesses;
create policy businesses_select_public on businesses for select using (true);

create or replace function is_business_limited(target_business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_limited from businesses where id = target_business_id), false);
$$;

create or replace function is_current_user_limited()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_limited from users where id = auth.uid()), false);
$$;

-- posts: bloquear creación si el dueño (cliente o negocio) está limitado.
drop policy if exists posts_insert_own on posts;
create policy posts_insert_own on posts for insert
  with check (
    (business_id is not null and is_business_staff(business_id) and not is_business_limited(business_id))
    or (client_id is not null and client_id = auth.uid() and not is_current_user_limited())
  );

-- stories: mismo criterio que posts.
drop policy if exists stories_insert_own on stories;
create policy stories_insert_own on stories for insert
  with check (
    (business_id is not null and is_business_staff(business_id) and not is_business_limited(business_id))
    or (client_id is not null and client_id = auth.uid() and not is_current_user_limited())
  );

-- ads: el insert directo casi no se usa (la fila real la crea el pago
-- confirmado con service role), pero se deja consistente igual.
drop policy if exists ads_insert_staff on ads;
create policy ads_insert_staff on ads for insert
  with check (is_business_staff(business_id) and not is_business_limited(business_id));

-- catálogo (servicios/productos): la lectura pública no cambia (sigue
-- using(true) en services_select_public/products_select_public); la
-- gestión completa (crear/editar/eliminar) se bloquea si el negocio está
-- limitado.
drop policy if exists services_staff_write on services;
create policy services_staff_write on services for all
  using (is_business_staff(business_id) and not is_business_limited(business_id))
  with check (is_business_staff(business_id) and not is_business_limited(business_id));

drop policy if exists products_staff_write on products;
create policy products_staff_write on products for all
  using (is_business_staff(business_id) and not is_business_limited(business_id))
  with check (is_business_staff(business_id) and not is_business_limited(business_id));

-- empleados: ver el equipo sigue funcionando, gestionarlo (alta/baja/edición) no.
drop policy if exists business_employees_staff_all on business_employees;
create policy business_employees_staff_select on business_employees for select
  using (is_business_staff(business_id));
create policy business_employees_staff_insert on business_employees for insert
  with check (is_business_staff(business_id) and not is_business_limited(business_id));
create policy business_employees_staff_update on business_employees for update
  using (is_business_staff(business_id) and not is_business_limited(business_id));
create policy business_employees_staff_delete on business_employees for delete
  using (is_business_staff(business_id) and not is_business_limited(business_id));

-- chat: el cliente nunca se bloquea; el negocio sí si está limitado.
drop policy if exists messages_insert on messages;
create policy messages_insert on messages for insert
  with check (
    sender_id = auth.uid()
    and (
      client_id = auth.uid()
      or (is_business_staff(business_id) and not is_business_limited(business_id))
    )
  );
