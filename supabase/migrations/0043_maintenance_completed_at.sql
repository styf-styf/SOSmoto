-- Necesario para mostrar mantenimientos completados en el Historial del
-- cliente ordenados correctamente junto a auxilios y citas.
alter table maintenance_suggestions add column completed_at timestamptz;
