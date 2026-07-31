-- Complementa 0150: además de "reemplazar" el perfil externo en
-- business_clients, re-vincula el historial de citas hechas ANTES de que
-- el cliente tuviera la app (appointments.client_id null +
-- external_client_phone). Sin esto, "Próximas citas"/"Historial contigo"
-- del cliente recién registrado no mostraría nada de lo que pasó antes de
-- registrarse, y el contador de visitas de getCRMClients tampoco lo
-- contaría.
--
-- Los informes de servicio (service_reports) SIN cita ni auxilio ligado
-- (standalone) NO se re-vinculan acá a propósito: ese caso solo tiene
-- external_client_name (no external_client_phone en esa tabla), y machear
-- por nombre es mucho menos confiable que por teléfono (nombres duplicados,
-- variaciones de escritura). Los que sí están ligados a una cita que se
-- acaba de re-vincular, se resuelven solos vía appointment_id.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
  v_phone_norm text;
begin
  v_role := case
    when new.raw_user_meta_data->>'role' = 'business' then 'business'::user_role
    else 'client'::user_role
  end;

  insert into public.users (id, email, phone, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_role
  );

  if v_role = 'client' then
    v_phone_norm := normalize_ec_phone(new.raw_user_meta_data->>'phone');
    if v_phone_norm <> '' then
      update public.business_clients bc
      set client_id = new.id, status = 'accepted',
          external_name = null, external_phone = null, external_email = null
      where bc.client_id is null
        and bc.external_phone is not null
        and normalize_ec_phone(bc.external_phone) = v_phone_norm
        and not exists (
          select 1 from public.business_clients other
          where other.business_id = bc.business_id and other.client_id = new.id
        );

      update public.appointments a
      set client_id = new.id, external_client_name = null, external_client_phone = null
      where a.client_id is null
        and a.external_client_phone is not null
        and normalize_ec_phone(a.external_client_phone) = v_phone_norm;

      update public.service_reports sr
      set client_id = new.id, external_client_name = null
      where sr.client_id is null
        and sr.appointment_id is not null
        and exists (
          select 1 from public.appointments a
          where a.id = sr.appointment_id and a.client_id = new.id
        );
    end if;
  end if;

  return new;
end;
$$;
