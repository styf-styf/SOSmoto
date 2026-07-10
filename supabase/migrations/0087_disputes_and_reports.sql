-- Auxilio: el admin puede dejar una nota y marcar una solicitud como
-- revisada (disputa: taller no llegó, cliente canceló sin razón, etc.).
alter table help_requests add column admin_notes text;
alter table help_requests add column dispute_status text not null default 'none'
  check (dispute_status in ('none', 'flagged', 'reviewed'));

-- Reportes de usuarios sobre contenido o negocios inapropiados. target_id
-- es polimórfico (según target_type) por eso no lleva FK -- se resuelve a
-- mano en el admin al listar.
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'review', 'business', 'product', 'service')),
  target_id uuid not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);
create index reports_status_idx on reports(status);
create index reports_target_idx on reports(target_type, target_id);

alter table reports enable row level security;
create policy reports_insert_own on reports for insert with check (reporter_id = auth.uid());
create policy reports_select_own on reports for select using (reporter_id = auth.uid());
