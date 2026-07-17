-- Chat con el asistente de IA (Claude) -- 1:1 usuario <-> asistente, distinto
-- de `messages` (que es cliente <-> negocio humano, sin concepto de "bot").
-- Sin Realtime: patrón síncrono de solicitud/respuesta (el usuario escribe,
-- la Edge Function responde en la misma llamada HTTP) -- no hay una segunda
-- parte humana que pueda escribir en cualquier momento.
create table ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  action jsonb,
  created_at timestamptz not null default now()
);

create index idx_ai_chat_messages_user_created on ai_chat_messages(user_id, created_at);

alter table ai_chat_messages enable row level security;

-- Solo lectura de los propios mensajes. Sin policies de insert/update/delete
-- para authenticated/anon -- todo el escritura pasa por la Edge Function
-- ai-assistant usando el service role, mismo patrón que `emails`.
create policy ai_chat_messages_select_own on ai_chat_messages
  for select using (user_id = auth.uid());
