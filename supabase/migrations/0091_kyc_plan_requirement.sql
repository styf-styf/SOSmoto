-- La verificacion de negocio (KYC / insignia "verificado") solo esta
-- disponible para negocios en un plan pago (Estandar o Pro) -- el plan Free
-- no puede enviar solicitud de verificacion. La UI (app/(business)/verificacion.tsx)
-- ya bloquea el formulario para Free, pero se refuerza aqui para que valga
-- sin importar por donde llegue el insert (mismo patron que
-- enforce_product_limit/enforce_service_limit/enforce_employee_limit en
-- 0089_enforce_plan_limits_backend.sql).
create or replace function enforce_kyc_plan_requirement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
begin
  select sp.name into v_plan
  from businesses b join subscription_plans sp on sp.id = b.plan_id
  where b.id = new.business_id;

  if v_plan = 'free' then
    raise exception 'La verificación de negocio (KYC) requiere un plan pago (Estándar o Pro). Sube de plan para solicitarla.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_kyc_plan_requirement_trigger on business_verification_requests;
create trigger enforce_kyc_plan_requirement_trigger
before insert on business_verification_requests
for each row execute function enforce_kyc_plan_requirement();
