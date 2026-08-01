-- =====================================================================
-- PARTE 1: fix de una regresión real que causó esta misma migración al
-- diseñarse -- protect_business_privileged_columns (0153) revierte
-- followers_count/rating_avg para cualquiera que no sea 'service_role',
-- pero las funciones que los mantienen sincronizados
-- (update_business_followers_count/update_business_rating, disparadas por
-- triggers en follows/reviews) corren en nombre de un usuario autenticado
-- normal -- auth.role() sigue devolviendo 'authenticated' aunque la función
-- sea SECURITY DEFINER, eso no cambia lo que ve auth.role() en un UPDATE
-- anidado. Confirmado en vivo: seguir un negocio dejó de subir
-- followers_count desde que se aplicó 0153, sin que nadie lo notara.
--
-- Fix: un flag de sesión LOCAL a la transacción (set_config con
-- is_local=true, se resetea solo al terminar la transacción) que las
-- funciones de confianza prenden justo antes de su propio UPDATE --
-- protect_business_privileged_columns lo revisa y se hace a un lado SOLO
-- para esa transacción puntual, sin abrir la puerta a nada más.
-- =====================================================================
create or replace function protect_business_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin()
     and auth.role() <> 'service_role'
     and coalesce(current_setting('app.bypass_column_protection', true), '') <> 'true' then
    new.plan_id := old.plan_id;
    new.is_limited := old.is_limited;
    new.limitation_reason := old.limitation_reason;
    new.is_verified := old.is_verified;
    new.rating_avg := old.rating_avg;
    new.followers_count := old.followers_count;
  end if;
  return new;
end;
$$;

create or replace function update_business_followers_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_column_protection', 'true', true);
  if (tg_op = 'INSERT') then
    update businesses set followers_count = followers_count + 1 where id = new.business_id;
  elsif (tg_op = 'DELETE') then
    update businesses set followers_count = followers_count - 1 where id = old.business_id;
  end if;
  return null;
end;
$$;

create or replace function update_business_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_business_id uuid;
begin
  target_business_id := coalesce(new.reviewed_business_id, old.reviewed_business_id);
  if target_business_id is null then
    return coalesce(new, old);
  end if;

  perform set_config('app.bypass_column_protection', 'true', true);
  update businesses
  set rating_avg = coalesce((
    select round(avg(rating)::numeric, 2)
    from reviews
    where reviewed_business_id = target_business_id and is_public = true
  ), 0)
  where id = target_business_id;

  return coalesce(new, old);
end;
$$;

-- =====================================================================
-- PARTE 2: bug encontrado de rebote (no auditoría) investigando cómo
-- implementar el contador de compartidos -- `posts` nunca tuvo ninguna
-- policy de UPDATE, así que editar una publicación (updatePost en
-- services/posts.ts, usado por PostDetail.tsx) fallaba siempre con un
-- error de permisos, tragado en el catch del modal sin que se notara.
-- =====================================================================
create policy posts_update_own on posts for update
  using (
    (business_id is not null and is_business_staff(business_id))
    or (client_id is not null and client_id = auth.uid())
    or is_admin()
  );

-- Columna vs. fila, mismo criterio que el resto de la auditoría: la policy
-- de arriba controla QUÉ FILA se puede tocar, no qué columnas -- sin esto,
-- el mismo dueño que legítimamente edita caption/photos/tag_* también
-- podría, vía un PATCH directo a la API, cambiarse el post a otro
-- business_id/client_id o escribirse comments_count/shares_count a mano.
-- Usa el MISMO flag de sesión que la parte 1 -- ver ahí la explicación de
-- por qué es necesario (evita repetir el bug con el contador de
-- comentarios/compartidos apenas se agregue esta protección).
create or replace function protect_post_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role'
     or is_admin()
     or coalesce(current_setting('app.bypass_column_protection', true), '') = 'true' then
    return new;
  end if;
  new.business_id := old.business_id;
  new.client_id := old.client_id;
  new.comments_count := old.comments_count;
  new.shares_count := old.shares_count;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists protect_post_columns on posts;
create trigger protect_post_columns
before update on posts
for each row execute function protect_post_columns();

create or replace function increment_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_column_protection', 'true', true);
  update posts set comments_count = comments_count + 1 where id = new.post_id;
  return new;
end;
$$;

create or replace function decrement_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_column_protection', 'true', true);
  update posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

create or replace function increment_post_shares(post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_column_protection', 'true', true);
  update posts set shares_count = shares_count + 1 where id = post_id;
end;
$$;
