-- FIX IMPORTANTE: messages_insert (0008, ampliado en 0128 con
-- can_reply_chat) solo exigía is_business_staff(business_id) del lado del
-- negocio -- client_id podía ser CUALQUIER uuid, sin relación previa
-- (auxilio, cita, business_clients, compra, informe). Los UUID de clientes
-- son cosechables desde reviewer_id en reseñas públicas (getBusinessReviews
-- hace select('*')), así que un negocio podía mandarle mensaje en frío a
-- cualquier cliente que haya reseñado a OTRO negocio -- vector real de
-- spam/acoso sin ningún guard de backend (el frontend nunca ofrece ese
-- botón, pero nada lo impedía llamando la API directo).
create or replace function business_has_client_relation(target_business_id uuid, target_client_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select
    exists (
      select 1 from business_clients bc
      where bc.business_id = target_business_id and bc.client_id = target_client_id and bc.status = 'accepted'
    )
    or exists (
      select 1 from appointments a
      where a.business_id = target_business_id and a.client_id = target_client_id
    )
    or exists (
      select 1 from help_requests hr
      join help_request_notifications hrn on hrn.help_request_id = hr.id
      where hrn.business_id = target_business_id and hr.client_id = target_client_id
    )
    or exists (
      select 1 from product_intents pi
      where pi.business_id = target_business_id and pi.client_id = target_client_id
    )
    or exists (
      select 1 from service_reports sr
      where sr.business_id = target_business_id and sr.client_id = target_client_id
    )
    -- El cliente ya escribió primero en este hilo (ej. pregunta desde el
    -- perfil del negocio sin haber reservado/comprado nada todavía) -- el
    -- negocio puede responder. Un negocio nunca puede ser quien ENVÍA el
    -- primer mensaje de un hilo sin una relación real de las de arriba.
    or exists (
      select 1 from messages m
      where m.business_id = target_business_id and m.client_id = target_client_id
    );
$$;

drop policy if exists messages_insert on messages;
create policy messages_insert on messages for insert
  with check (
    sender_id = auth.uid()
    and (
      client_id = auth.uid()
      or (
        is_business_staff(business_id)
        and not is_business_limited(business_id)
        and can_reply_chat(business_id)
        and business_has_client_relation(business_id, client_id)
      )
    )
  );
