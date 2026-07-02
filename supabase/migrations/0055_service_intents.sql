create type service_intent_status as enum ('pending', 'confirmed', 'unavailable', 'cancelled');

create table service_intents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  status service_intent_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index service_intents_pending_unique on service_intents(client_id, service_id) where status = 'pending';
create index service_intents_business_id_idx on service_intents(business_id);
create index service_intents_client_id_idx on service_intents(client_id);

alter table service_intents enable row level security;

create policy service_intents_client_select on service_intents
  for select using (client_id = auth.uid());

create policy service_intents_client_insert on service_intents
  for insert with check (client_id = auth.uid());

create policy service_intents_client_update on service_intents
  for update using (client_id = auth.uid()) with check (status = 'cancelled');

create policy service_intents_business_select on service_intents
  for select using (is_business_staff(business_id));

create policy service_intents_business_update on service_intents
  for update using (is_business_staff(business_id));
