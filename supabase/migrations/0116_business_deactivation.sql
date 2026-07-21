-- "Desactivar negocio temporalmente" (CLAUDE.md, Configuración > General) --
-- distinto de is_limited (que el admin impone y NO oculta el perfil de
-- búsquedas, ver estado-cuenta.tsx). Este lo controla el propio dueño para
-- volverse invisible un tiempo (ej. vacaciones) sin perder nada al reactivar.
alter table businesses add column is_deactivated boolean not null default false;
