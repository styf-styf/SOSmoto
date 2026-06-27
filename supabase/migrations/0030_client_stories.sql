-- Los clientes (motociclistas) también pueden subir historias de 24h,
-- visibles públicamente para todos los clientes (feed de "Comunidad").
-- Una historia pertenece a un negocio O a un cliente, nunca ambos.
alter table stories alter column business_id drop not null;
alter table stories add column client_id uuid references users(id) on delete cascade;

alter table stories add constraint stories_owner_check
  check ((business_id is not null and client_id is null) or (client_id is not null and business_id is null));

-- Fijar como destacado permanente sigue siendo exclusivo del plan Pro de negocios.
alter table stories add constraint stories_client_not_pinned
  check (client_id is null or is_pinned = false);

create index stories_client_id_idx on stories(client_id);

-- El cliente no tiene catálogo de servicios/productos: la única acción posible
-- además de "ninguno"/"contactar" es etiquetar un negocio.
alter type story_action_type add value 'business_tag';

-- Reemplaza enforce_story_limit para soportar las dos ramas: negocio (límite
-- por plan, como antes) y cliente (límite fijo de 3 historias/día, sin pin).
create or replace function enforce_story_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_allowed int;
  plan_name text;
  current_count int;
begin
  if new.business_id is not null then
    select sp.max_active_stories, sp.name::text into max_allowed, plan_name
    from businesses b join subscription_plans sp on sp.id = b.plan_id
    where b.id = new.business_id;

    if max_allowed is null then return new; end if;

    select count(*) into current_count from stories
    where business_id = new.business_id
      and (is_pinned or created_at > now() - interval '24 hours');

    if current_count >= max_allowed then
      raise exception 'Límite del plan % alcanzado (% historias activas permitidas)', plan_name, max_allowed;
    end if;
  else
    select count(*) into current_count from stories
    where client_id = new.client_id
      and created_at > now() - interval '24 hours';

    if current_count >= 3 then
      raise exception 'Límite diario alcanzado (3 historias por día)';
    end if;
  end if;

  return new;
end;
$$;

-- RLS: las 4 policies originales asumían business_id not null; se reemplazan
-- para cubrir ambos dueños.
drop policy stories_select_visible on stories;
create policy stories_select_visible on stories for select
  using (
    (business_id is not null and (is_pinned or created_at > now() - interval '24 hours'))
    or (client_id is not null and created_at > now() - interval '24 hours')
    or (business_id is not null and is_business_staff(business_id))
    or (client_id is not null and client_id = auth.uid())
    or is_admin()
  );

drop policy stories_insert_staff on stories;
create policy stories_insert_own on stories for insert
  with check (
    (business_id is not null and is_business_staff(business_id))
    or (client_id is not null and client_id = auth.uid())
  );

drop policy stories_update_staff_or_admin on stories;
create policy stories_update_own_or_admin on stories for update
  using (
    (business_id is not null and is_business_staff(business_id))
    or (client_id is not null and client_id = auth.uid())
    or is_admin()
  );

drop policy stories_delete_staff_or_admin on stories;
create policy stories_delete_own_or_admin on stories for delete
  using (
    (business_id is not null and is_business_staff(business_id))
    or (client_id is not null and client_id = auth.uid())
    or is_admin()
  );

-- Storage: el cliente sube su foto de historia bajo client-stories/{user_id}/,
-- mismo bucket public-images (0021_image_storage.sql) pero el check es
-- auth.uid() directo en vez de is_business_staff, porque el cliente no tiene
-- fila en `businesses`.
create policy "public_images_insert_client_stories" on storage.objects for insert
  with check (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] = 'client-stories'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "public_images_delete_client_stories" on storage.objects for delete
  using (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] = 'client-stories'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
