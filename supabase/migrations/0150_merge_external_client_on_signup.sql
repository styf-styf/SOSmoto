-- Cuando un negocio agrega un cliente "externo" (sin cuenta en la app --
-- caso típico: taller crea la cita a mano, o lo invita por WhatsApp a
-- descargar la app), queda guardado en business_clients con client_id null
-- y external_name/external_phone/vehicles. Si ese mismo teléfono se registra
-- después como cuenta real, este trigger "reemplaza" el perfil externo por
-- el real automáticamente: basta con setear client_id + status='accepted'
-- en esa fila -- getCRMClients() (services/history.ts) ya decide
-- is_external solo mirando si client_id está seteado, así que a partir de
-- acá esa fila se ve y se comporta como cualquier cliente real de la app,
-- sin tocar nada más.
--
-- El emparejamiento es por teléfono normalizado (no por link ni código):
-- los negocios no tienen ninguna forma confiable de generar un link que
-- sobreviva instalar la app desde cero (necesitaría deferred deep linking,
-- ej. Branch.io, que este proyecto no tiene), así que el teléfono es la
-- señal más simple que ya tenemos en ambos lados.

create or replace function public.normalize_ec_phone(raw text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  if raw is null then return ''; end if;
  digits := regexp_replace(raw, '[^0-9]', '', 'g');
  if digits = '' then return ''; end if;
  if left(digits, 3) = '593' then return digits; end if;
  if left(digits, 1) = '0' then return '593' || substring(digits from 2); end if;
  return '593' || digits;
end;
$$;

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

  -- Solo aplica a clientes reales (no negocios) -- un business_clients.
  -- client_id representa específicamente una relación negocio→cliente.
  if v_role = 'client' then
    v_phone_norm := normalize_ec_phone(new.raw_user_meta_data->>'phone');
    if v_phone_norm <> '' then
      -- external_name debe quedar null junto con client_id (constraint
      -- business_clients_owner_check) -- external_phone/email también se
      -- limpian porque ya son redundantes (el cliente real trae los suyos
      -- propios desde `users`, ver getCRMClients). Se excluye cualquier
      -- fila cuyo negocio ya tenga a este mismo client_id agregado por otro
      -- lado (invitación normal vía addAppClient), para no chocar con el
      -- índice único business_clients_app_unique.
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
    end if;
  end if;

  return new;
end;
$$;
