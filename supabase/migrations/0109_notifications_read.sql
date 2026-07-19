-- Estado de leído para la bandeja de notificaciones (campanita del perfil):
-- sin esto no había forma de mostrar un indicador de "nuevas" ni de marcarlas
-- como vistas al abrir la lista.
alter table notifications add column read boolean not null default false;

create index idx_notifications_user_unread on notifications(user_id) where not read;

-- El propio usuario marca sus notificaciones como leídas al abrir la bandeja
-- (NotificationsScreen) -- no hay Edge Function de por medio para esto.
create policy notifications_update_own on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
