-- FIX CRÍTICO: handle_new_user confiaba en el campo `role` que viaja en
-- raw_user_meta_data de auth.users.signUp() -- ese dato lo controla 100%
-- quien hace la llamada (viaja en options.data del propio POST /signup).
-- La restricción a 'client'/'business' (Exclude<UserRole,'admin'>) solo
-- existía como tipo de TypeScript en el frontend (services/auth.ts) -- nada
-- impedía llamar signUp() directo con { data: { role: 'admin' } } y quedar
-- con is_admin() = true, acceso total al panel de administración.
--
-- Ahora el trigger nunca deja pasar 'admin': solo 'business' si el valor
-- pedido es exactamente ese, 'client' para cualquier otro caso (incluido
-- 'admin' o cualquier valor inválido/ausente).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, phone, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when new.raw_user_meta_data->>'role' = 'business' then 'business'::user_role
      else 'client'::user_role
    end
  );
  return new;
end;
$$;
