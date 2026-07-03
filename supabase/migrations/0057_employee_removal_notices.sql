-- Persiste un aviso cuando el dueño elimina a un mecánico.
-- El mecánico lo ve al volver a abrir la app y decide qué hacer.
create table employee_removal_notices (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references users(id) on delete cascade,
  business_name text      not null,
  created_at  timestamptz not null default now()
);

alter table employee_removal_notices enable row level security;

-- El mecánico solo puede ver y eliminar sus propios avisos
create policy "employee_removal_notices_select" on employee_removal_notices
  for select using (user_id = auth.uid());

create policy "employee_removal_notices_delete" on employee_removal_notices
  for delete using (user_id = auth.uid());

-- Cualquier sesión autenticada puede insertar (el dueño inserta el aviso del mecánico)
create policy "employee_removal_notices_insert" on employee_removal_notices
  for insert with check (auth.uid() is not null);

-- RPC para que un usuario cambie su propio rol de 'business' a 'client'.
-- SECURITY DEFINER porque la policy de RLS de la tabla users no permite
-- que un usuario actualice su propio campo role directamente.
create or replace function change_role_to_client()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update users set role = 'client' where id = auth.uid() and role = 'business';
end $$;
