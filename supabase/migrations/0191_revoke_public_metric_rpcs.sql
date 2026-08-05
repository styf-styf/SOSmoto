-- 0190 revocó de "anon" y no sirvió -- se confirmó con
-- has_function_privilege() y consultando pg_proc.proacl directo: estas 3
-- funciones nunca tuvieron un grant explícito a "anon", su acceso venía
-- del grant implícito a PUBLIC que Postgres agrega automáticamente al
-- crear cualquier función (visible en el ACL como "=X/postgres", la
-- entrada sin nombre de rol). Todo rol -- incluido anon -- es miembro
-- implícito de PUBLIC, así que revocar de "anon" nunca iba a tener efecto
-- mientras ese grant a PUBLIC siguiera ahí. Este es el revoke que
-- realmente lo cierra.
revoke execute on function increment_catalog_views(uuid, text) from public;
revoke execute on function increment_ad_metric(uuid, text) from public;
revoke execute on function increment_story_metric(uuid, text) from public;
