-- FIX IMPORTANTE #1: las invitaciones no expiraban nunca -- una invitación
-- olvidada de hace meses seguía siendo aceptable indefinidamente.
alter table employee_invitations
  add column if not exists expires_at timestamptz not null default (now() + interval '14 days');

-- FIX IMPORTANTE #2: acceptInvitation() (services/employeeInvitations.ts)
-- inserta en business_employees con la sesión del INVITADO, pero la única
-- policy de insert (business_employees_staff_insert, 0039) exige
-- is_business_staff(business_id) -- el invitado nunca es staff todavía,
-- ese es justo el punto de la invitación. El insert fallaba siempre por
-- RLS ("new row violates row-level security policy").
create policy business_employees_accept_invitation on business_employees for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from employee_invitations ei
      where ei.business_id = business_employees.business_id
        and ei.invitee_id = auth.uid()
        and ei.status = 'pending'
        and ei.expires_at > now()
    )
  );
