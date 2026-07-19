-- Historial de notificaciones push -- hasta ahora notifyUser() (services/
-- notifications.ts) solo enviaba el push por Expo sin dejar rastro en la
-- base de datos, así que no había forma de mostrar una bandeja con el
-- historial. Esta tabla registra cada notificación enviada para poder
-- listarla en la campanita del perfil (cliente y negocio).
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_created on notifications(user_id, created_at desc);

alter table notifications enable row level security;

create policy notifications_select_own on notifications
  for select using (user_id = auth.uid());

-- notifyUser() se dispara desde la sesión del usuario que ORIGINA el evento
-- (ej. el cliente que pide auxilio) hacia OTRO usuario (el taller que lo
-- recibe) -- no hay Edge Function de por medio. Mismo nivel de confianza que
-- ya existe hoy en este flujo para leer el push_token de otro usuario
-- (getPushToken en services/notifications.ts), así que el insert también se
-- permite para cualquier user_id.
create policy notifications_insert_any on notifications
  for insert to authenticated with check (true);
