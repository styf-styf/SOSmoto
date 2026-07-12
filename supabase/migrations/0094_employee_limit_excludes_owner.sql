-- max_employees ahora representa personas ADICIONALES permitidas en el
-- equipo, sin contar al dueño (antes incluía al dueño y el código restaba 1
-- en todos lados: services/employees.ts, employeeInvitations.ts,
-- empleados.tsx y esta misma función). Free pasa de 1 a 0 porque un negocio
-- Free no puede sumar personal, solo el dueño opera la cuenta. Estándar (3)
-- y Pro (ilimitado/null) no cambian de valor porque ya representaban el
-- número real de personas adicionales que se quería permitir.
update subscription_plans set max_employees = 0 where name = 'free';

create or replace function enforce_employee_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_plan text;
  v_count int;
begin
  select sp.max_employees, sp.name into v_max, v_plan
  from businesses b join subscription_plans sp on sp.id = b.plan_id
  where b.id = new.business_id;

  if v_max is null then
    return new;
  end if;

  -- business_employees nunca incluye una fila para el dueño (su acceso viene
  -- de businesses.owner_id) -- v_count ya es el conteo de personas
  -- adicionales, se compara directo contra v_max sin restar nada.
  select count(*) into v_count from business_employees
  where business_id = new.business_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_max then
    raise exception 'Tu plan % permite hasta % personas adicionales en el equipo (sin contar al dueño). Sube de plan para agregar más.', v_plan, v_max;
  end if;

  return new;
end;
$$;
