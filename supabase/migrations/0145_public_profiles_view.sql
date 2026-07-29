-- FIX del hueco que 0129 dejó documentado a propósito: las policies de
-- "autor de contenido público visible" (historia/post/comentario) daban
-- acceso de FILA completa a `users` -- como RLS es por fila y no por
-- columna, cualquier usuario autenticado (sin ninguna relación real con
-- ese autor) podía pedir email/phone del autor de cualquier post/historia/
-- comentario público con su propio JWT, aunque la app solo pida
-- full_name/avatar_url en sus consultas.
--
-- Solución: una vista `public_profiles` que SOLO expone id/full_name/
-- avatar_url (nunca email/phone/role/etc.) -- las vistas en Postgres/
-- Supabase corren con los privilegios de quien las crea (bypassa RLS de la
-- tabla de abajo) salvo que se declaren `security_invoker`, así que
-- cualquier `authenticated` puede leerla completa sin exponer columnas
-- sensibles, porque la vista física no las tiene. Se eliminan las 4
-- policies de autoría pública en `users` (ya no hacen falta -- la app pasa
-- a resolver nombre/avatar de autor vía esta vista, no vía join directo a
-- `users`) y con eso se cierra el acceso de fila completo que las hacía
-- riesgosas. Las policies de relación real (business_clients, help_requests,
-- appointments, product_intents, service_reports) NO se tocan -- esas sí
-- necesitan email/phone y siguen intactas.
create view public_profiles
with (security_invoker = false)
as
select id, full_name, avatar_url from users;

grant select on public_profiles to authenticated;

drop policy if exists users_select_for_visible_client_story on users;
drop policy if exists users_select_for_visible_post_author on users;
drop policy if exists users_select_for_post_comment_author on users;
drop policy if exists users_select_for_ad_comment_author on users;
