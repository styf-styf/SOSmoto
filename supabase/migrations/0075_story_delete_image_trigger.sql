-- Cuando se elimina una historia (manualmente o por el cron 0074),
-- llama a la Edge Function delete-story-image vía pg_net para borrar
-- la imagen de Supabase Storage en el mismo instante.
create extension if not exists pg_net;

create or replace function handle_story_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.image_url is not null then
    perform net.http_post(
      url := 'https://logsjwjvberfsqjfqwob.supabase.co/functions/v1/delete-story-image',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
        )
      ),
      body := jsonb_build_object('image_url', OLD.image_url)
    );
  end if;
  return OLD;
end;
$$;

create trigger stories_delete_image
after delete on stories
for each row execute function handle_story_deleted();
