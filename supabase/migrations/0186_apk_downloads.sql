-- Registra cada clic en "Descargar APK" de sosmoto.net (piloto, sin Google
-- Play/App Store todavía). Solo timestamp -- nada de IP/user-agent, no hace
-- falta para el único propósito de esto: contar cuántas descargas hubo.
-- Se escribe desde web/api/negocios.js (?descargar=1) con la service role
-- key, nunca desde el cliente -- RLS deny-all a propósito, ni el negocio
-- ni el cliente autenticado puede leer/escribir esto, solo el service role
-- (el mismo endpoint de descarga y el admin panel).
create table apk_downloads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table apk_downloads enable row level security;
