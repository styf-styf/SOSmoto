-- El admin debe poder activar Pro-Taller y Pro-Tienda al mismo tiempo
-- (mismo nivel de plan, dos tipos de negocio) -- lo único que nunca puede
-- coexistir activo es Estándar y Pro simultáneamente (para que la
-- promoción de lanzamiento sea consistente: todos con el mismo nivel, no
-- una mezcla). Antes, el índice único bloqueaba cualquier segunda fila
-- activa sin importar el nombre del plan, impidiendo cubrir taller y
-- tienda a la vez con el toggle automático.

drop index if exists one_active_plan_promotion;

create or replace function enforce_single_active_promotion_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_name text;
  v_conflict boolean;
begin
  if not new.is_active then
    return new;
  end if;

  select name into v_new_name from subscription_plans where id = new.plan_id;

  select exists (
    select 1
    from plan_promotions pp
    join subscription_plans sp on sp.id = pp.plan_id
    where pp.is_active
      and pp.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and sp.name <> v_new_name
  ) into v_conflict;

  if v_conflict then
    raise exception 'Ya hay una promoción activa de otro plan (Estándar/Pro). Desactívala primero.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_single_active_promotion_tier_trigger on plan_promotions;
create trigger enforce_single_active_promotion_tier_trigger
before insert or update on plan_promotions
for each row execute function enforce_single_active_promotion_tier();
