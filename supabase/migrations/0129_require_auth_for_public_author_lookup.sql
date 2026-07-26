-- FIX IMPORTANTE (mitigación parcial, ver nota abajo): las policies de
-- users_select_for_visible_client_story/post_author/post_comment_author/
-- ad_comment_author (0034/0036) -- usadas para que el join embebido a
-- `users` en stories/posts/post_comments muestre nombre/avatar del autor --
-- no exigían ni siquiera auth.uid() is not null, a diferencia de
-- users_search_clients (0068) que sí lo exigía. Cualquiera, sin sesión,
-- podía leer el email/teléfono de cualquier cliente que alguna vez publicó
-- una historia/post/comentario visible.
--
-- NOTA IMPORTANTE (limitación real de RLS, no resuelta acá): estas
-- policies operan a nivel de FILA, no de columna -- exigir autenticación
-- cierra el acceso anónimo, pero un usuario autenticado cualquiera (un
-- cliente sin ninguna relación con el autor) sigue pudiendo leer el email/
-- teléfono completos de ese autor, porque el join de la app solo pide
-- full_name/avatar_url pero la policy de fila no puede restringir qué
-- columnas se leen si alguien hace la consulta directo con su propio JWT.
-- Cerrar esto del todo requeriría revocar el grant de columna sobre
-- phone/email para el rol authenticated y mover TODAS las lecturas
-- legítimas de esas columnas a funciones SECURITY DEFINER -- es un cambio
-- de arquitectura más grande que se deja para una migración aparte,
-- evaluado con más cuidado.
drop policy if exists users_select_for_visible_client_story on users;
create policy users_select_for_visible_client_story on users for select
  using (
    auth.uid() is not null
    and exists (
      select 1 from stories s
      where s.client_id = users.id
        and s.created_at > now() - interval '24 hours'
    )
  );

drop policy if exists users_select_for_visible_post_author on users;
create policy users_select_for_visible_post_author on users for select
  using (
    auth.uid() is not null
    and exists (select 1 from posts p where p.client_id = users.id)
  );

drop policy if exists users_select_for_post_comment_author on users;
create policy users_select_for_post_comment_author on users for select
  using (
    auth.uid() is not null
    and exists (select 1 from post_comments pc where pc.author_id = users.id)
  );

drop policy if exists users_select_for_ad_comment_author on users;
create policy users_select_for_ad_comment_author on users for select
  using (
    auth.uid() is not null
    and exists (select 1 from ad_comments ac where ac.author_id = users.id)
  );
