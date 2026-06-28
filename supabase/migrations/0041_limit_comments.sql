-- Extiende el sistema de "limitar" para bloquear también comentarios (en
-- publicaciones y anuncios), tanto de clientes limitados como de negocios
-- limitados. Los comentarios no tienen business_id propio -- el autor puede
-- ser un cliente o el dueño/empleado de un negocio -- por eso se resuelve
-- contra is_limited del propio usuario (cliente) O is_limited de cualquier
-- negocio del que sea dueño/empleado (negocio), en vez de reusar
-- is_current_user_limited() que solo mira la fila de `users`.
create or replace function is_author_limited()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_limited from users where id = auth.uid()), false)
    or exists (select 1 from businesses b where b.owner_id = auth.uid() and b.is_limited)
    or exists (
      select 1 from business_employees be
      join businesses b on b.id = be.business_id
      where be.user_id = auth.uid() and b.is_limited
    );
$$;

drop policy if exists post_comments_insert_own on post_comments;
create policy post_comments_insert_own on post_comments for insert
  with check (author_id = auth.uid() and not is_author_limited());

drop policy if exists ad_comments_insert_own on ad_comments;
create policy ad_comments_insert_own on ad_comments for insert
  with check (author_id = auth.uid() and not is_author_limited());
