-- La X en los banners del chat (solicitud de cita, apartado, cita
-- confirmada, cotización...) solo ocultaba el banner en el estado local de
-- React (dismissedBanners) -- volvía a aparecer al reabrir el chat porque
-- ese estado nunca se guardaba en ningún lado. Mismo espíritu que
-- hidden_chats (0163) pero por banner individual, no por chat completo:
-- banner_key identifica cuál (ej. "req:<id>", "intent:<id>", "appt:<id>",
-- "quote:<id>") -- ocultar uno no afecta a los demás de la misma
-- conversación. Reemplaza el estado 'dismissed' que se agregó a
-- chat_quotes en 0170 (ver services/chatQuotes.ts) -- ahora TODOS los
-- banners usan este mismo mecanismo genérico, no solo cotizaciones.
create table hidden_chat_banners (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid not null references users(id) on delete cascade,
  banner_key text not null,
  hidden_by text not null check (hidden_by in ('client', 'business')),
  hidden_at timestamptz not null default now(),
  unique (business_id, client_id, banner_key, hidden_by)
);
create index idx_hidden_chat_banners_lookup on hidden_chat_banners(business_id, client_id, hidden_by);

alter table hidden_chat_banners enable row level security;

create policy hidden_chat_banners_select on hidden_chat_banners for select
  using (
    (hidden_by = 'client' and client_id = auth.uid())
    or (hidden_by = 'business' and is_business_staff(business_id))
  );

create policy hidden_chat_banners_insert on hidden_chat_banners for insert
  with check (
    (hidden_by = 'client' and client_id = auth.uid())
    or (hidden_by = 'business' and is_business_staff(business_id))
  );

-- Update (no solo insert) por si algún día hace falta re-ocultar (unique
-- constraint) -- mismo motivo que hidden_chats.
create policy hidden_chat_banners_update on hidden_chat_banners for update
  using (
    (hidden_by = 'client' and client_id = auth.uid())
    or (hidden_by = 'business' and is_business_staff(business_id))
  );
