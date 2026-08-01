-- Segunda tanda de fixes de una auditoría de seguridad (2026-08-01),
-- continuación de 0142. Cada bloque documenta el hueco exacto que cierra.

-- =====================================================================
-- 1) CRÍTICO: web_login_tickets nunca tenía RLS activado -- cualquiera con
--    la anon key (pública en la app) podía:
--    a) leer owner_id de cualquier negocio (businesses_select_public es
--       público a propósito), y
--    b) insertar directo un ticket para ESE owner_id vía la API de
--       PostgREST (sin RLS, el grant por defecto de Supabase deja
--       insert/select a anon/authenticated), y
--    c) canjear ese ticket contra web-login-exchange (pública a propósito,
--       ver ese archivo) y recibir una sesión real y válida de esa cuenta.
--    Toma de cuenta completa sin ninguna credencial. Las dos Edge
--    Functions que sí necesitan tocar esta tabla (web-login-ticket,
--    web-login-exchange) ya usan la service_role key, que ignora RLS --
--    no hace falta ninguna policy permisiva.
-- =====================================================================
alter table web_login_tickets enable row level security;

-- =====================================================================
-- 2) help_requests: help_requests_client_all (0002) y
--    help_requests_business_update (0002, redefinida en 0007/0128) solo
--    restringen QUÉ FILA se puede tocar, nunca QUÉ COLUMNAS -- mismo patrón
--    de hueco que 0088 ya cerró para users/businesses.
--
--    Exploit real: un cliente podía crear su propia help_request y luego
--    hacerle un PATCH directo a accepted_business_id (cualquier negocio) +
--    status:'completed', fabricando una interacción completa con un
--    negocio que nunca participó -- suficiente para pasar
--    review_interaction_valid() (0131) y postear una reseña pública falsa.
--    Un negocio "notificado" (no necesariamente el que aceptó, ya que
--    TODOS los talleres en el radio reciben la notificación) podía además
--    robarle accepted_business_id a un competidor que ya había aceptado, o
--    reescribir la ubicación/descripción del cliente en una emergencia real.
-- =====================================================================
create or replace function protect_help_request_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;

  -- Actor = el cliente dueño de la fila: nunca puede tocar las columnas que
  -- son responsabilidad exclusiva del negocio que de verdad la atiende.
  if auth.uid() = old.client_id then
    new.accepted_business_id := old.accepted_business_id;
    new.accepted_at := old.accepted_at;
    new.business_latitude := old.business_latitude;
    new.business_longitude := old.business_longitude;
    new.business_location_updated_at := old.business_location_updated_at;
    new.estimated_arrival_minutes := old.estimated_arrival_minutes;
  else
    -- Actor = negocio (o cualquiera que no sea el cliente dueño): nunca
    -- puede tocar los datos originales del cliente/la emergencia.
    new.client_id := old.client_id;
    new.vehicle_id := old.vehicle_id;
    new.latitude := old.latitude;
    new.longitude := old.longitude;
    new.description := old.description;
    new.created_at := old.created_at;

    -- Anti-robo: si accepted_business_id ya tiene un negocio asignado,
    -- solo ESE negocio (o el cliente, ya cubierto arriba) puede seguir
    -- modificándolo -- cualquier otro negocio notificado no puede
    -- pisárselo ni aunque pase la policy de fila.
    if old.accepted_business_id is not null
       and new.accepted_business_id is distinct from old.accepted_business_id
       and not is_business_staff(old.accepted_business_id) then
      new.accepted_business_id := old.accepted_business_id;
      new.accepted_at := old.accepted_at;
      new.status := old.status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_help_request_columns on help_requests;
create trigger protect_help_request_columns
before update on help_requests
for each row execute function protect_help_request_columns();

-- =====================================================================
-- 3) appointments: mismo problema.
--    a) appointments_client_insert (0124) deja insertar con cualquier
--       `status` -- un cliente podía crear directo una fila con
--       status:'completed' contra cualquier taller, sin pasar nunca por
--       el flujo real de solicitud/aceptación. Se restringe a solo poder
--       insertar en 'pending'.
--    b) appointments_client_update / appointments_business_update (0016,
--       client redefinida en 0124) no restringen columnas -- el cliente
--       podía marcar su propia cita 'completed' (nunca lo hace la app,
--       solo el negocio la marca completada) para fabricar una reseña
--       antes de que el servicio pasara de verdad, y el negocio podía
--       reescribir client_id.
-- =====================================================================
drop policy if exists appointments_client_insert on appointments;
create policy appointments_client_insert on appointments for insert
  with check (client_id = auth.uid() and is_workshop_business(business_id) and status = 'pending');

create or replace function protect_appointment_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;

  if auth.uid() = old.client_id then
    -- El cliente nunca marca su propia cita como completada -- eso
    -- siempre lo hace el negocio (ver completeAppointment en
    -- services/appointments.ts, solo se llama desde pantallas de negocio).
    if new.status = 'completed' then
      new.status := old.status;
    end if;
    new.business_id := old.business_id;
    new.service_id := old.service_id;
  else
    new.client_id := old.client_id;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_appointment_columns on appointments;
create trigger protect_appointment_columns
before update on appointments
for each row execute function protect_appointment_columns();

-- =====================================================================
-- 4) businesses: protect_business_privileged_columns (0088) protege
--    plan_id/is_limited/limitation_reason/is_verified pero nunca incluyó
--    rating_avg ni followers_count -- ambos son factores de ranking de
--    búsqueda y followers_count además alimenta el badge de confianza
--    social, y un negocio podía escribírselos directo (PATCH a su propia
--    fila, que sí puede tocar vía businesses_update_staff).
-- =====================================================================
create or replace function protect_business_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() and auth.role() <> 'service_role' then
    new.plan_id := old.plan_id;
    new.is_limited := old.is_limited;
    new.limitation_reason := old.limitation_reason;
    new.is_verified := old.is_verified;
    new.rating_avg := old.rating_avg;
    new.followers_count := old.followers_count;
  end if;
  return new;
end;
$$;

-- =====================================================================
-- 5) search_clients_by_name (0122) no tenía ningún límite de velocidad --
--    cualquier cuenta de negocio (gratis, instantánea, sin KYC) podía
--    iterar substrings de nombres comunes ("a", "ma", "an"...) sin límite
--    y cosechar nombre+teléfono de toda la base de clientes. Se agrega un
--    límite de 20 llamadas/minuto por cuenta, con una tabla de rastreo
--    reusable para futuros RPCs que necesiten lo mismo.
-- =====================================================================
create table if not exists rpc_rate_limits (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references users(id) on delete cascade,
  rpc_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists rpc_rate_limits_lookup_idx
  on rpc_rate_limits (caller_id, rpc_name, created_at);

-- Deny-all a propósito: solo la toca código SECURITY DEFINER de acá en
-- adelante, ni siquiera el dueño de las filas debería poder leer/borrar
-- su propio historial de rate limit por la app.
alter table rpc_rate_limits enable row level security;

create or replace function search_clients_by_name(search_query text)
returns table (id uuid, full_name text, phone text)
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
    select u.id, u.full_name, u.phone
    from users u
    where u.role = 'client'
      and u.full_name ilike '%' || trim(search_query) || '%'
    order by u.full_name
    limit 8;
end;
$$;
