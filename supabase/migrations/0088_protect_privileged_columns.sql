-- Varias policies de UPDATE solo restringen QUÉ FILA se puede tocar
-- (`using (id = auth.uid())` / `using (is_business_staff(id))`), pero no
-- restringen QUÉ COLUMNAS -- un usuario autenticado puede hacer un update
-- directo contra la API de Supabase (sin pasar por el código de la app) y
-- cambiar columnas que deberían ser exclusivas del admin/backend: su propio
-- rol, su propio plan, su propio estado de verificación/limitación, o las
-- notas/estado de disputa de auxilio.
--
-- RLS no permite comparar OLD vs NEW columna por columna en una sola policy,
-- así que se usa un trigger BEFORE UPDATE que revierte esas columnas
-- puntuales al valor anterior si quien escribe no es admin ni el
-- service_role (usado por el panel admin y las Edge Functions).

create or replace function protect_user_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() and auth.role() <> 'service_role' then
    new.role := old.role;
    new.is_limited := old.is_limited;
    new.limitation_reason := old.limitation_reason;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_users_privileged_columns on users;
create trigger protect_users_privileged_columns
before update on users
for each row execute function protect_user_privileged_columns();

create or replace function protect_business_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() and auth.role() <> 'service_role' then
    new.plan_id := old.plan_id;
    new.is_limited := old.is_limited;
    new.limitation_reason := old.limitation_reason;
    new.is_verified := old.is_verified;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_businesses_privileged_columns on businesses;
create trigger protect_businesses_privileged_columns
before update on businesses
for each row execute function protect_business_privileged_columns();

create or replace function protect_help_request_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() and auth.role() <> 'service_role' then
    new.admin_notes := old.admin_notes;
    new.dispute_status := old.dispute_status;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_help_requests_admin_columns on help_requests;
create trigger protect_help_requests_admin_columns
before update on help_requests
for each row execute function protect_help_request_admin_columns();

-- Defensa en profundidad: aunque hoy el admin solo consulta `reports` con la
-- service-role key (bypassa RLS), agregamos una policy explícita para que
-- también funcione si algún día se consulta con la key anon/authenticated.
create policy reports_admin_all on reports for all using (is_admin()) with check (is_admin());
