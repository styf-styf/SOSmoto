-- Mismo bug que 0034_users_select_for_visible_story.sql, sin corregir para
-- publicaciones y comentarios: `posts`, `post_comments` y `ad_comments` son
-- públicamente legibles (select using (true)), pero `users` solo permite
-- verse a uno mismo (users_select_own) o casos puntuales. El join a `users`
-- para mostrar el autor de una publicación de cliente o de un comentario
-- (post_comments.author_id, ad_comments.author_id) devolvía null para
-- cualquiera que no fuera el propio usuario.

create policy users_select_for_visible_post_author on users for select
  using (
    exists (
      select 1 from posts p
      where p.client_id = users.id
    )
  );

create policy users_select_for_post_comment_author on users for select
  using (
    exists (
      select 1 from post_comments pc
      where pc.author_id = users.id
    )
  );

create policy users_select_for_ad_comment_author on users for select
  using (
    exists (
      select 1 from ad_comments ac
      where ac.author_id = users.id
    )
  );
