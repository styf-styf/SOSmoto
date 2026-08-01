-- search_clients_by_name (0122, rate-limitado en 0153) solo devolvía
-- id/full_name/phone -- la pantalla de Nueva cita quiere mostrar el avatar
-- real del cliente en vez de un ícono genérico, y para eso el buscador
-- global (clientes fuera del CRM del negocio) también necesita avatar_url.
-- avatar_url no es dato sensible como el teléfono (ya se muestra en el
-- chat/reseñas a cualquier negocio con el que el cliente interactúa), así
-- que sumarlo no cambia el perfil de riesgo de esta función.
-- drop explícito: Postgres no permite CREATE OR REPLACE cuando cambia el
-- tipo de fila devuelta (columna nueva en el OUT), solo agregar defaults.
drop function if exists search_clients_by_name(text);

create or replace function search_clients_by_name(search_query text)
returns table (id uuid, full_name text, phone text, avatar_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_calls int;
begin
  if not is_any_business_staff() then
    return;
  end if;
  if length(trim(search_query)) < 2 then
    return;
  end if;

  select count(*) into recent_calls
  from rpc_rate_limits
  where caller_id = auth.uid()
    and rpc_name = 'search_clients_by_name'
    and created_at > now() - interval '1 minute';

  if recent_calls >= 20 then
    raise exception 'Demasiadas búsquedas seguidas. Espera un minuto e intenta de nuevo.';
  end if;

  insert into rpc_rate_limits (caller_id, rpc_name) values (auth.uid(), 'search_clients_by_name');

  return query
    select u.id, u.full_name, u.phone, u.avatar_url
    from users u
    where u.role = 'client'
      and u.full_name ilike '%' || trim(search_query) || '%'
    order by u.full_name
    limit 8;
end;
$$;
