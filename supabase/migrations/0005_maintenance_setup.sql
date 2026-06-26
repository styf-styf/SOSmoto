-- Falta el tipo de moto en vehicles (necesario para filtrar maintenance_rules) y la
-- política de insert en maintenance_suggestions (solo existían select/update).
alter table vehicles add column moto_type moto_type;

create policy maintenance_suggestions_owner_insert on maintenance_suggestions for insert
  with check (
    exists (select 1 from vehicles v where v.id = maintenance_suggestions.vehicle_id and v.user_id = auth.uid())
  );

-- Reglas genéricas de mantenimiento por tipo de moto (MVP: mismos intervalos para todos los tipos).
insert into maintenance_rules (moto_type, service_name, interval_km, interval_months) values
  ('scooter', 'Cambio de aceite', 3000, null),
  ('scooter', 'Revisión de frenos', 6000, null),
  ('scooter', 'Cambio de cadena/transmisión', 12000, null),
  ('street', 'Cambio de aceite', 3000, null),
  ('street', 'Revisión de frenos', 6000, null),
  ('street', 'Cambio de cadena/transmisión', 12000, null),
  ('naked', 'Cambio de aceite', 3000, null),
  ('naked', 'Revisión de frenos', 6000, null),
  ('naked', 'Cambio de cadena/transmisión', 12000, null),
  ('enduro', 'Cambio de aceite', 3000, null),
  ('enduro', 'Revisión de frenos', 6000, null),
  ('enduro', 'Cambio de cadena/transmisión', 12000, null),
  ('sport', 'Cambio de aceite', 3000, null),
  ('sport', 'Revisión de frenos', 6000, null),
  ('sport', 'Cambio de cadena/transmisión', 12000, null),
  ('cruiser', 'Cambio de aceite', 3000, null),
  ('cruiser', 'Revisión de frenos', 6000, null),
  ('cruiser', 'Cambio de cadena/transmisión', 12000, null);
