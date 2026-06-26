-- Mantiene businesses.followers_count sincronizado con la tabla follows.
-- Necesario porque el cliente no tiene permiso (RLS) para actualizar businesses directamente;
-- el trigger corre con privilegios de sistema y sí puede.
create or replace function public.update_business_followers_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update businesses set followers_count = followers_count + 1 where id = new.business_id;
  elsif (tg_op = 'DELETE') then
    update businesses set followers_count = followers_count - 1 where id = old.business_id;
  end if;
  return null;
end;
$$;

create trigger on_follow_change
  after insert or delete on follows
  for each row execute function public.update_business_followers_count();
