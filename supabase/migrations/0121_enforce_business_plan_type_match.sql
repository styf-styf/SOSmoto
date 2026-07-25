-- Ningun camino que asigna subscription_plans.id a businesses.plan_id
-- (reclamo de promocion, asignacion manual del admin, payphone-confirm,
-- cambio a plan gratis desde la app o desde el portal web) validaba que el
-- plan fuera del mismo business_type que el negocio -- desde que se separaron
-- los planes de taller/tienda (0119_merge_brand_into_store.sql) existen dos
-- filas "Estandar"/"Pro" con el mismo nombre, y nada impedia asignarle a una
-- tienda el plan_id de la fila de taller (o viceversa), rompiendo sus limites
-- reales (servicios, empleados, variantes/escalones).
create or replace function enforce_business_plan_type_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_business_type business_type;
begin
  if new.plan_id is null then
    return new;
  end if;
  if TG_OP = 'UPDATE' and new.plan_id = old.plan_id then
    return new;
  end if;

  select business_type into v_plan_business_type
  from subscription_plans
  where id = new.plan_id;

  if v_plan_business_type is not null and v_plan_business_type <> new.business_type then
    raise exception 'Ese plan no corresponde al tipo de negocio (taller/tienda).';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_business_plan_type_match_trigger on businesses;
create trigger enforce_business_plan_type_match_trigger
before insert or update on businesses
for each row execute function enforce_business_plan_type_match();
