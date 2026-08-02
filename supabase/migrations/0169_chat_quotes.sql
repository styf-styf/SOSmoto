-- El banner "Apartar"/"Agendar" que aparece tras enviar una cotización en el
-- chat vivía solo en estado local de React (se perdía al cerrar y reabrir
-- el chat) -- se pidió que sea persistente, igual que los demás banners de
-- seguimiento (apartados, citas), que sí sobreviven porque están respaldados
-- por una fila real en la base de datos. Tabla mínima solo para esto: no
-- reemplaza product_intents/appointments, esos se siguen creando recién al
-- Apartar/Agendar -- esta tabla solo trackea "cotización enviada, todavía
-- sin acción" para poder mostrar el banner de nuevo al volver al chat.
create table chat_quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('product', 'service')),
  label text not null,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  quantity int,
  service_id uuid references services(id) on delete set null,
  unit_price numeric,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'cancelled')),
  created_at timestamptz not null default now()
);
create index idx_chat_quotes_business_client on chat_quotes(business_id, client_id) where status = 'pending';

alter table chat_quotes enable row level security;

-- Solo el negocio ve/toca esto -- es su propio recordatorio interno, el
-- cliente nunca ve este banner (ver chat/[id].tsx), así que no hay policy
-- alguna para el lado cliente.
create policy chat_quotes_all_business on chat_quotes for all
  using (is_business_staff(business_id))
  with check (is_business_staff(business_id));
