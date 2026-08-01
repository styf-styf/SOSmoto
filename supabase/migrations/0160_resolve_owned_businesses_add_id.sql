-- resolve_owned_businesses (0158) le faltó el id del negocio -- history.ts
-- (getClientProfileForBusiness) lo necesita para armar el link "ver perfil
-- de negocio" (app/(business)/cliente/[id].tsx), no solo el owner_id.
drop function if exists resolve_owned_businesses(uuid[]);
create function resolve_owned_businesses(target_ids uuid[])
returns table (id uuid, owner_id uuid, name text, logo_url text)
language sql
security definer
stable
set search_path = public
as $$
  select b.id, b.owner_id, b.name, b.logo_url
  from businesses b
  where b.owner_id = any(target_ids);
$$;
