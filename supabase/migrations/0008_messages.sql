-- Chat cliente <-> negocio. No se usa una tabla "conversations" separada: el hilo entre
-- un cliente y un negocio queda implícito en el par (client_id, business_id).
create table messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index idx_messages_thread on messages(client_id, business_id, created_at);

alter table messages enable row level security;

create policy messages_select on messages for select
  using (client_id = auth.uid() or is_business_staff(business_id));

create policy messages_insert on messages for insert
  with check (
    sender_id = auth.uid()
    and (client_id = auth.uid() or is_business_staff(business_id))
  );

create policy messages_update_read on messages for update
  using (client_id = auth.uid() or is_business_staff(business_id));

alter publication supabase_realtime add table messages;
