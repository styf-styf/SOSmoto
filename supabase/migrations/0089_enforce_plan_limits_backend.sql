-- Los límites de plan (productos/servicios/empleados) solo se validaban en
-- services/catalog.ts y services/employees.ts, código que corre en el
-- dispositivo del usuario -- cualquier insert/update directo contra la API
-- de Supabase evita el chequeo. Estos triggers los hacen valer también en
-- el backend, sin importar por dónde llegue la escritura.

create or replace function enforce_product_limit()
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
  if new.is_active is distinct from true then
    return new;
  end if;

  select sp.max_products, sp.name into v_max, v_plan
  from businesses b join subscription_plans sp on sp.id = b.plan_id
  where b.id = new.business_id;

  if v_max is null then
    return new;
  end if;

  select count(*) into v_count from products
  where business_id = new.business_id and is_active = true
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_max then
    raise exception 'Tu plan % permite hasta % productos activos. Sube de plan para agregar más.', v_plan, v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_product_limit_trigger on products;
create trigger enforce_product_limit_trigger
before insert or update on products
for each row execute function enforce_product_limit();

create or replace function enforce_service_limit()
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
  if new.is_active is distinct from true then
    return new;
  end if;

  select sp.max_services, sp.name into v_max, v_plan
  from businesses b join subscription_plans sp on sp.id = b.plan_id
  where b.id = new.business_id;

  if v_max is null then
    return new;
  end if;

  select count(*) into v_count from services
  where business_id = new.business_id and is_active = true
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_max then
    raise exception 'Tu plan % permite hasta % servicios activos. Sube de plan para agregar más.', v_plan, v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_service_limit_trigger on services;
create trigger enforce_service_limit_trigger
before insert or update on services
for each row execute function enforce_service_limit();

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

  -- max_employees incluye al dueño -- se resta 1 (mismo criterio que
  -- services/employees.ts: allowedAdditional = maxEmployees - 1).
  select count(*) into v_count from business_employees
  where business_id = new.business_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= (v_max - 1) then
    raise exception 'Tu plan % permite hasta % personas en el negocio (incluyendo al dueño). Sube de plan para agregar más.', v_plan, v_max;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_employee_limit_trigger on business_employees;
create trigger enforce_employee_limit_trigger
before insert on business_employees
for each row execute function enforce_employee_limit();
