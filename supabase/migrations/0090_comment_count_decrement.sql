-- post_comments/ad_comments solo tenían un trigger que suma 1 a
-- comments_count al insertar -- nunca se le restaba al eliminar un
-- comentario, así que el contador quedaría inflado apenas el admin empiece
-- a borrar comentarios desde moderación.

create or replace function decrement_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

create trigger post_comments_decrement
after delete on post_comments
for each row execute function decrement_post_comments_count();

create or replace function decrement_ad_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update ads set comments_count = greatest(comments_count - 1, 0) where id = old.ad_id;
  return old;
end;
$$;

create trigger ad_comments_decrement
after delete on ad_comments
for each row execute function decrement_ad_comments_count();
