-- Contador de veces que se compartió una publicación -- mismo tratamiento
-- visual que comments_count (ver PostCard.tsx). No existe ninguna policy de
-- UPDATE en `posts` (RLS deniega por default sin una que matchee), así que
-- se expone solo vía esta función SECURITY DEFINER, mismo patrón que
-- increment_ad_metric (0020_ad_metrics.sql) -- cualquiera que vea/comparta
-- la publicación puede contar la métrica, sin necesitar permiso de UPDATE
-- general sobre la fila.
alter table posts add column shares_count int not null default 0;

create or replace function increment_post_shares(post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update posts set shares_count = shares_count + 1 where id = post_id;
end;
$$;

grant execute on function increment_post_shares(uuid) to authenticated;
