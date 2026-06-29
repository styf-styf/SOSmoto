-- Guarda el kilometraje real con el que se marco el mantenimiento como hecho,
-- para mostrarlo en el Historial (due_at_km es el objetivo, no lo real).
alter table maintenance_suggestions add column completed_at_km int;
