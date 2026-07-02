-- Tabla de invitaciones pendientes: el dueño invita por email antes de insertar en business_employees
create table employee_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  invitee_id uuid not null references users(id) on delete cascade,
  can_accept_aid_requests boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Solo una invitación pendiente por par (business, invitee)
create unique index employee_invitations_pending_uniq
  on employee_invitations(business_id, invitee_id)
  where status = 'pending';

alter table employee_invitations enable row level security;

-- El invitado y el staff del negocio pueden ver las invitaciones
create policy "inv_select" on employee_invitations for select using (
  invitee_id = auth.uid() or is_business_staff(business_id) or is_admin()
);

-- Solo el staff del negocio puede crear invitaciones
create policy "inv_insert" on employee_invitations for insert with check (
  is_business_staff(business_id)
);

-- Solo el invitado puede aceptar/rechazar
create policy "inv_update" on employee_invitations for update using (
  invitee_id = auth.uid() or is_admin()
);

-- El staff del negocio o admin pueden cancelar (eliminar) una invitación
create policy "inv_delete" on employee_invitations for delete using (
  is_business_staff(business_id) or is_admin()
);
