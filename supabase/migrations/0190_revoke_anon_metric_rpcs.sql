-- Mismo hueco que se encontró y corrigió para log_map_load (0188/0189):
-- estas 3 funciones se crearon con "grant execute ... to authenticated"
-- pero nunca revocaron el grant que Supabase le da por defecto al rol
-- "anon" al crear cualquier función nueva -- se confirmó probándolas con
-- la anon key (sin sesión) y las tres respondían sin error.
--
-- Se revisó primero que ninguna se llame desde sosmoto.net (la única
-- superficie pública sin login) -- no hay ningún "products"/"services"
-- visibles sin cuenta en la app móvil tampoco, así que anon nunca tiene un
-- caso de uso legítimo para llamarlas.
revoke execute on function increment_catalog_views(uuid, text) from anon;
revoke execute on function increment_ad_metric(uuid, text) from anon;
revoke execute on function increment_story_metric(uuid, text) from anon;
