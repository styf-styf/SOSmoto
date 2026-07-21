-- Preferencias de notificación por tipo (CLAUDE.md, Configuración >
-- Notificaciones) -- antes "Notificaciones" en Configuración solo abría el
-- permiso del sistema operativo (on/off global), sin ningún control fino.
-- Objeto vacío = todo activado (ausencia de una clave nunca apaga nada, así
-- que usuarios existentes no pierden notificaciones por default).
alter table users add column notification_prefs jsonb not null default '{}'::jsonb;
