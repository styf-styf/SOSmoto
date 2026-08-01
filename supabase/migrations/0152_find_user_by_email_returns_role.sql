-- addEmployeeByEmail (services/employees.ts) buscaba el id de la cuenta
-- invitada por correo sin revisar su rol -- si esa cuenta era 'client', la
-- invitación se creaba y hasta se podía "aceptar" en teoría, pero la
-- pantalla para aceptarla (getMyPendingInvitations, ver empleados.tsx)
-- solo vive dentro de app/(business)/, a la que un rol 'client' nunca
-- entra -- la invitación quedaba fantasma, sin ninguna forma de aceptarla.
-- Ahora la función también devuelve el rol para que el cliente pueda
-- avisar antes de mandar la invitación, en vez de fallar en silencio.
drop function if exists find_user_id_by_email(text);

create function find_user_id_by_email(target_email text)
returns table (id uuid, role user_role)
language sql
stable security definer
as $$
  select id, role from users where email = target_email limit 1;
$$;
