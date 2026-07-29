-- help_request_notifications_client_insert (0006) solo verificaba que quien
-- inserta sea dueño de la solicitud de auxilio -- nunca validaba que el
-- `business_id` notificado tuviera sentido geográfico. Como la app arma la
-- lista de talleres a notificar en el cliente (findNearbyWorkshops,
-- services/helpRequests.ts), un cliente comprometido/modificado podía
-- insertar una fila de notificación para CUALQUIER negocio, sin importar la
-- distancia -- y ese negocio automáticamente ganaba lectura completa de la
-- solicitud (incluida la ubicación exacta en vivo del cliente, ver
-- 0013_help_request_business_location.sql) y podía aceptarla/gestionarla.
--
-- La función de abajo replica EXACTO el mismo algoritmo que ya usa el
-- cliente (utils/distance.ts, Haversine) más el fallback intencional de
-- seguridad: si NINGÚN taller tiene al cliente dentro de su radio
-- configurado, se permite notificar a los 5 más cercanos igual (marcados
-- out_of_range en la UI) -- nunca se debe dejar una emergencia sin nadie a
-- quien notificar solo por no tener talleres con cobertura ahí. Replicar
-- este fallback en el server es importante: una policy que solo chequeara
-- "distancia <= aid_radius_km" habría roto esa red de seguridad real.
create or replace function business_eligible_for_help_request(p_business_id uuid, p_help_request_id uuid)
returns boolean
language sql
security definer
stable
as $$
  with req as (
    select latitude, longitude from help_requests where id = p_help_request_id
  ),
  candidates as (
    select
      b.id,
      b.aid_radius_km,
      (
        6371 * 2 * asin(least(1.0, sqrt(
          sin(radians((b.latitude - req.latitude) / 2)) ^ 2 +
          cos(radians(req.latitude)) * cos(radians(b.latitude)) *
          sin(radians((b.longitude - req.longitude) / 2)) ^ 2
        )))
      ) as distance_km
    from businesses b, req
    where b.business_type = 'workshop'
      and b.is_available_for_aid = true
      and b.is_deactivated = false
      and b.aid_radius_km is not null
  ),
  in_range as (
    select id from candidates where distance_km <= aid_radius_km
  ),
  fallback as (
    select id from candidates order by distance_km asc limit 5
  )
  select case
    when exists (select 1 from in_range) then p_business_id in (select id from in_range)
    else p_business_id in (select id from fallback)
  end;
$$;

drop policy if exists help_request_notifications_client_insert on help_request_notifications;
create policy help_request_notifications_client_insert on help_request_notifications for insert
  with check (
    exists (
      select 1 from help_requests hr
      where hr.id = help_request_notifications.help_request_id and hr.client_id = auth.uid()
    )
    and business_eligible_for_help_request(business_id, help_request_id)
  );
