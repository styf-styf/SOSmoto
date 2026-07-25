-- enforce_photo_limit() (0115) solo protegía products/services -- posts
-- comparte el mismo max_photos_per_item del plan para publicaciones de
-- negocio (ver comentario en services/posts.ts y CreateBusinessPostBox.tsx),
-- pero nunca tuvo su propio trigger, solo se validaba en el frontend. Se
-- redefine la función para que el mensaje diga "publicación" en esa tabla
-- (en vez de "producto/servicio") y se agrega el trigger sobre posts.
--
-- posts.business_id es nullable (posts de cliente usan client_id) -- cuando
-- es null, el join no encuentra negocio, v_max/v_plan quedan null y la
-- función no aplica ningún límite (los posts de cliente siguen su propio
-- tope fijo MAX_POST_PHOTOS_CLIENT, validado solo en frontend, sin relación
-- a ningún plan).
create or replace function enforce_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_plan text;
  v_count int;
  v_noun text;
begin
  select sp.max_photos_per_item, sp.name into v_max, v_plan
  from businesses b join subscription_plans sp on sp.id = b.plan_id
  where b.id = new.business_id;

  if v_max is null then
    return new;
  end if;

  v_count := coalesce(array_length(new.photos, 1), 0);

  if v_count > v_max then
    v_noun := case when TG_TABLE_NAME = 'posts' then 'publicación' else 'producto/servicio' end;
    raise exception 'Tu plan % permite hasta % foto% por %. Sube de plan para agregar más.',
      v_plan, v_max, (case when v_max = 1 then '' else 's' end), v_noun;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_photo_limit_posts_trigger on posts;
create trigger enforce_photo_limit_posts_trigger
before insert or update on posts
for each row execute function enforce_photo_limit();
