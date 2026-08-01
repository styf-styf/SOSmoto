-- "Eliminar chat" en la lista de Mensajes -- mismo comportamiento que
-- WhatsApp: desaparece SOLO del lado de quien lo borra (el otro lado
-- conserva su historial intacto), y vuelve a aparecer solo si llega un
-- mensaje nuevo después del momento en que se ocultó. No se borra ningún
-- mensaje real -- messages no tiene noción de "por usuario", así que se
-- guarda la marca de ocultado aparte y se filtra al armar la lista de
-- conversaciones (services/messages.ts).
create table hidden_chats (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  hidden_by text not null check (hidden_by in ('client', 'business')),
  hidden_at timestamptz not null default now(),
  unique (client_id, business_id, hidden_by)
);

alter table hidden_chats enable row level security;

-- El lado "client" lo controla el cliente dueño del hilo; el lado
-- "business" lo controla cualquier staff del negocio (dueño o empleado) --
-- ocultar un chat es una acción del negocio como entidad, no de una
-- persona en particular, mismo criterio que el resto de la app.
create policy hidden_chats_select on hidden_chats for select
  using (
    (hidden_by = 'client' and client_id = auth.uid())
    or (hidden_by = 'business' and is_business_staff(business_id))
  );

create policy hidden_chats_insert on hidden_chats for insert
  with check (
    (hidden_by = 'client' and client_id = auth.uid())
    or (hidden_by = 'business' and is_business_staff(business_id))
  );

-- Update (no solo insert) porque re-ocultar un chat que ya estaba oculto
-- antes (unique constraint) hace upsert -- necesita permiso para
-- actualizar hidden_at en vez de fallar por conflicto.
create policy hidden_chats_update on hidden_chats for update
  using (
    (hidden_by = 'client' and client_id = auth.uid())
    or (hidden_by = 'business' and is_business_staff(business_id))
  );
