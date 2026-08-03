-- getClientConversations/getBusinessConversations (services/messages.ts) traían
-- TODOS los mensajes históricos del usuario/negocio (sin límite) solo para
-- quedarse, tras un dedupe en JS, con la última fila de cada conversación --
-- el costo de la consulta escala con el volumen de mensajes de toda la vida,
-- no con el número (chico) de conversaciones visibles. Se mueve el "última
-- fila por contraparte" a la base con DISTINCT ON, mucho más barato.
create or replace function public.get_client_conversations(target_client_id uuid)
returns table (
  business_id uuid,
  body text,
  image_url text,
  created_at timestamptz,
  sender_id uuid,
  read_at timestamptz
)
language sql
security definer
stable
as $$
  select business_id, body, image_url, created_at, sender_id, read_at
  from (
    select distinct on (business_id) business_id, body, image_url, created_at, sender_id, read_at
    from messages
    where client_id = target_client_id
    order by business_id, created_at desc, id desc
  ) latest
  where target_client_id = auth.uid()
  order by created_at desc;
$$;

grant execute on function public.get_client_conversations(uuid) to authenticated;

create or replace function public.get_business_conversations(target_business_id uuid)
returns table (
  client_id uuid,
  body text,
  image_url text,
  created_at timestamptz,
  sender_id uuid,
  read_at timestamptz
)
language sql
security definer
stable
as $$
  select client_id, body, image_url, created_at, sender_id, read_at
  from (
    select distinct on (client_id) client_id, body, image_url, created_at, sender_id, read_at
    from messages
    where business_id = target_business_id
    order by client_id, created_at desc, id desc
  ) latest
  where is_business_staff(target_business_id)
  order by created_at desc;
$$;

grant execute on function public.get_business_conversations(uuid) to authenticated;
