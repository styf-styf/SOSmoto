-- chat/[id].tsx necesita is_verified además de id/name/logo_url al resolver
-- si el otro lado de un chat (un client_id ya conocido) es dueño de un
-- negocio (chat B2B) -- mismo dato que ya es público vía businesses_public,
-- se agrega acá para no necesitar una segunda consulta.
drop function if exists resolve_owned_businesses(uuid[]);
create function resolve_owned_businesses(target_ids uuid[])
returns table (id uuid, owner_id uuid, name text, logo_url text, is_verified boolean)
language sql
security definer
stable
set search_path = public
as $$
  select b.id, b.owner_id, b.name, b.logo_url, b.is_verified
  from businesses b
  where b.owner_id = any(target_ids);
$$;
