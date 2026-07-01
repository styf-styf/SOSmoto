-- Registro de interés de un cliente en un producto ("Apartar").
-- No es un checkout -- el pago sigue siendo off-app. Solo crea un hilo de
-- seguimiento que el negocio puede confirmar o rechazar desde el chat.
create type product_intent_status as enum ('pending', 'confirmed', 'unavailable', 'cancelled');

create table product_intents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  status product_intent_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_intents_client_idx on product_intents(client_id);
create index product_intents_business_idx on product_intents(business_id);
create index product_intents_product_idx on product_intents(product_id);

-- Un solo "apartar" activo por cliente por producto a la vez.
create unique index product_intents_pending_unique
  on product_intents(client_id, product_id)
  where status = 'pending';

alter table product_intents enable row level security;

create policy product_intents_select_client on product_intents
  for select using (client_id = auth.uid());

create policy product_intents_select_business on product_intents
  for select using (is_business_staff(business_id));

create policy product_intents_insert_client on product_intents
  for insert with check (client_id = auth.uid());

create policy product_intents_update_client on product_intents
  for update using (client_id = auth.uid());

create policy product_intents_update_business on product_intents
  for update using (is_business_staff(business_id));
