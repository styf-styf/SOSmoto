-- 0188 revocó de PUBLIC pero el rol anon seguía pudiendo llamar la función
-- -- se verificó con la anon key después de aplicar 0188 y seguía
-- insertando sin sesión. La causa real: Supabase configura
-- "alter default privileges in schema public grant execute on functions to
-- anon, authenticated" a nivel de proyecto, así que cada función nueva
-- recibe un grant DIRECTO a "anon" al crearse (no heredado de PUBLIC) --
-- revocar de PUBLIC no lo toca. Hay que revocar de "anon" explícitamente.
revoke execute on function log_map_load(text) from anon;
