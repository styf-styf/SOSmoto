-- Bug: getVisibleClientStories() hace join users!stories_client_id_fkey(...)
-- para mostrar nombre/avatar del autor en la fila de Historias, pero la
-- tabla `stories` es públicamente legible (stories_select_visible) mientras
-- que `users` solo permite verse a uno mismo (users_select_own) o casos muy
-- puntuales (solicitud de auxilio activa, cita, empleado). Eso hacía que el
-- join devolviera null para casi todos los clientes -- y groupStoriesByAuthor
-- descarta cualquier historia cuyo autor venga null -- así que solo se veían
-- los clientes que coincidían por casualidad con alguna de esas políticas
-- puntuales (ej. tener una cita con el negocio del que se está viendo el feed).
create policy users_select_for_visible_client_story on users for select
  using (
    exists (
      select 1 from stories s
      where s.client_id = users.id
        and s.created_at > now() - interval '24 hours'
    )
  );
