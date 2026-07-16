-- Bandeja de correo del panel admin: recibidos (via webhook de Resend/Svix,
-- ver supabase/functions/email-webhook) y enviados (via admin/lib/resend.ts).
-- Se unifican en una sola tabla para poder listarlos/filtrarlos juntos por
-- alias e hilo, igual que el patrón usado en EcuaPred.
create table emails (
  id text primary key default gen_random_uuid()::text, -- normalmente el email_id que devuelve Resend
  type text not null check (type in ('received', 'sent')),
  alias text not null, -- dirección @sosmoto.app dueña del hilo (to en recibidos, from en enviados)
  from_address text not null,
  to_address text not null,
  subject text not null default '',
  html text,
  text text,
  message_id text,
  in_reply_to text,
  thread_references text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_emails_alias_created on emails(alias, created_at desc);
create index idx_emails_type on emails(type);
create index idx_emails_in_reply_to on emails(in_reply_to) where in_reply_to is not null;

alter table emails enable row level security;

-- Solo lectura para admins. No hay policies de insert/update/delete para
-- authenticated/anon: todas las mutaciones pasan por Route Handlers del
-- admin (createAdminClient(), service role), igual que el resto del panel.
-- Esta policy de select es la que permite que Supabase Realtime SÍ entregue
-- eventos al admin conectado desde el navegador -- sin ella, el canal no
-- entrega nada aunque el insert lo haga el service role (Realtime respeta
-- RLS del lado del cliente suscrito).
create policy emails_select_admin on emails for select using (is_admin());

alter publication supabase_realtime add table emails;

-- Whitelist de alias @sosmoto.app habilitados para recibir/enviar. El
-- webhook de recepción NO rechaza correos a direcciones fuera de esta
-- lista (para no perder correo real por un alias mal configurado); solo la
-- usa para agrupar/mostrar pestañas en el frontend.
create table email_aliases (
  alias text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

alter table email_aliases enable row level security;
create policy email_aliases_select_admin on email_aliases for select using (is_admin());

insert into email_aliases (alias, label) values
  ('info@sosmoto.app', 'Información general'),
  ('soporte@sosmoto.app', 'Soporte técnico'),
  ('alertas@sosmoto.app', 'Alertas del sistema'),
  ('admin@sosmoto.app', 'Administración');
