-- Solicitud de eliminación de cuenta con período de gracia de 30 días
-- (antes era un simple mailto: a soporte, sin ningún registro ni forma de
-- cancelar). El usuario pide la eliminación desde la app, opcionalmente con
-- un motivo; queda "pendiente" 30 días (tiempo en el que puede cancelar), y
-- pasado ese plazo un cron la finaliza (anonimiza, no borra -- ver
-- supabase/functions/process-account-deletions, evita romper la retención
-- de pagos/facturación que ya promete sosmoto.net/eliminar-cuenta).
create table account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'completed')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '30 days'),
  cancelled_at timestamptz,
  completed_at timestamptz
);

-- Solo una solicitud pendiente a la vez por usuario -- evita duplicados si
-- el formulario se envía dos veces o el usuario vuelve a intentarlo.
create unique index account_deletion_requests_one_pending_per_user
  on account_deletion_requests(user_id)
  where status = 'pending';

create index account_deletion_requests_scheduled_idx
  on account_deletion_requests(scheduled_for)
  where status = 'pending';

alter table account_deletion_requests enable row level security;

create policy account_deletion_requests_select_own on account_deletion_requests
  for select using (user_id = auth.uid() or is_admin());

create policy account_deletion_requests_insert_own on account_deletion_requests
  for insert with check (user_id = auth.uid());

-- El usuario solo puede cancelar (pending -> cancelled) su propia solicitud
-- -- nunca marcarla 'completed' él mismo, eso es exclusivo del cron
-- (service_role, que bypasea RLS). Un trigger (no una policy) es lo que
-- puede comparar el status VIEJO contra el nuevo en la misma fila.
create or replace function protect_account_deletion_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;
  if old.user_id != auth.uid() then
    new := old;
    return new;
  end if;
  if old.status = 'pending' and new.status = 'cancelled' then
    new.cancelled_at := now();
    new.reason := old.reason;
    new.requested_at := old.requested_at;
    new.scheduled_for := old.scheduled_for;
    new.completed_at := old.completed_at;
    return new;
  end if;
  -- Cualquier otro intento de cambio (incluyendo marcarla 'completed') se
  -- descarta silenciosamente -- vuelve a la fila tal como estaba.
  new := old;
  return new;
end;
$$;

create trigger protect_account_deletion_status
before update on account_deletion_requests
for each row execute function protect_account_deletion_status();

create policy account_deletion_requests_update_own on account_deletion_requests
  for update using (user_id = auth.uid() or is_admin());
