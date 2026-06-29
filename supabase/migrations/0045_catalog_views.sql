alter table products add column views int not null default 0;
alter table services add column views int not null default 0;

-- mismo patron que increment_ad_metric (0020_ad_metrics.sql) / increment_story_metric (0028_stories.sql)
create or replace function increment_catalog_views(item_id uuid, item_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if item_type = 'product' then
    update products set views = views + 1 where id = item_id;
  elsif item_type = 'service' then
    update services set views = views + 1 where id = item_id;
  end if;
end;
$$;

grant execute on function increment_catalog_views(uuid, text) to authenticated;
