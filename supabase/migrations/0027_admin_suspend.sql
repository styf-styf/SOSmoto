-- Soporte para suspender/reactivar cuentas desde el panel de administración.
-- El bloqueo real de login de un usuario suspendido ocurre vía GoTrue
-- (auth.admin.updateUserById con ban_duration, hecho desde el panel admin) --
-- is_suspended aquí es solo una bandera de lectura rápida para listar/filtrar.
alter table users add column is_suspended boolean not null default false;
alter table businesses add column is_suspended boolean not null default false;

drop policy if exists businesses_select_public on businesses;
create policy businesses_select_public on businesses
  for select using (not is_suspended or is_business_staff(id) or is_admin());
