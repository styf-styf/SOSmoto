-- FIX MENOR: getDueMaintenance() (services/maintenance.ts) primero consulta
-- si ya existe una sugerencia activa para (vehicle_id, rule_id) y, si no,
-- inserta una -- dos llamadas casi simultáneas (dos dispositivos con la
-- misma cuenta, o un doble render rápido) pueden ambas ver "no existe" y
-- ambas insertar, duplicando la sugerencia (y potencialmente duplicando
-- los push del cron check-maintenance). Los ciclos ya completados deben
-- poder acumularse en el historial (no es un duplicado real), así que el
-- índice único solo aplica a las sugerencias todavía activas
-- (pending/notified) -- solo puede haber una por vehículo+regla a la vez.
create unique index if not exists maintenance_suggestions_active_unique
  on maintenance_suggestions(vehicle_id, rule_id)
  where status in ('pending', 'notified');
