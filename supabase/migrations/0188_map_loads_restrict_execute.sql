-- Postgres otorga EXECUTE a PUBLIC por defecto al crear una función -- el
-- "grant ... to authenticated" de 0187 no alcanza para bloquear al rol
-- anon, que sigue teniendo el grant implícito de PUBLIC. Se descubrió al
-- probar log_map_load() con la anon key: insertaba sin sesión. Hace falta
-- revocar PUBLIC explícitamente para que el grant a authenticated sea la
-- única vía.
revoke execute on function log_map_load(text) from public;
