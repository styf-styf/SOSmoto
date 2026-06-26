-- Incrementa impresiones/clics de un anuncio. SECURITY DEFINER porque la policy
-- ads_update_staff_or_admin solo permite UPDATE al staff del negocio o admin,
-- pero cualquier cliente autenticado que ve/toca el anuncio debe poder contar la métrica.
create or replace function increment_ad_metric(ad_id uuid, metric text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if metric = 'impression' then
    update ads set impressions = impressions + 1 where id = ad_id;
  elsif metric = 'click' then
    update ads set clicks = clicks + 1 where id = ad_id;
  end if;
end;
$$;

grant execute on function increment_ad_metric(uuid, text) to authenticated;
