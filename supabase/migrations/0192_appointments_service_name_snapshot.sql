-- appointments nunca guardó un snapshot del nombre del servicio, solo el FK
-- vivo (a diferencia de appointment_requests.service_name, que sí lo hace
-- desde 0060). Eso hacía que borrar un servicio con CUALQUIER historial de
-- citas quedara bloqueado para siempre por Postgres
-- (appointments_service_id_fkey nunca tuvo "on delete set null/cascade",
-- a diferencia de las demás tablas que referencian services) -- ni
-- siquiera citas ya completadas/canceladas se podían "resolver", el
-- bloqueo era permanente. Además, desactivar el servicio en su lugar no
-- es una salida real para negocios en plan Free/Estándar: nunca les
-- libera el cupo de catálogo para cargar un servicio distinto en su
-- lugar... espera, sí lo libera (el trigger enforce_catalog_limit solo
-- cuenta is_active=true), pero el negocio igual queda con basura
-- acumulada en su catálogo de gestión para siempre sin poder limpiarla.
alter table appointments add column service_name text;

-- Backfill: copiar el nombre actual del servicio a las citas existentes
-- que todavía tienen service_id vivo.
update appointments a
set service_name = s.name
from services s
where a.service_id = s.id and a.service_name is null;

-- Mismo patrón que appointment_requests.service_id: al borrar el servicio,
-- la cita sobrevive (pierde el vínculo vivo pero conserva service_name
-- como respaldo para mostrar en el historial).
alter table appointments drop constraint appointments_service_id_fkey;
alter table appointments add constraint appointments_service_id_fkey
  foreign key (service_id) references services(id) on delete set null;
