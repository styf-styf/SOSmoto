-- Permite que el taller cree citas para clientes externos (sin cuenta en la app).
-- client_id pasa a ser nullable; si es null, los campos externos identifican al cliente.

alter table appointments alter column client_id drop not null;

alter table appointments
  add column external_client_name text,
  add column external_client_phone text;

-- Índice útil para filtrar citas externas
create index idx_appointments_external on appointments(business_id) where client_id is null;
