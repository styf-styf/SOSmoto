create type story_action_type as enum ('service', 'product', 'contact', 'none');

create table stories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  image_url text not null,
  caption text,
  action_type story_action_type not null default 'none',
  action_target_id uuid,
  is_pinned boolean not null default false,
  views int not null default 0,
  clicks int not null default 0,
  created_at timestamptz not null default now()
);
create index stories_business_id_idx on stories(business_id);

-- quien vio que historia (para el anillo "sin ver" -- distinto del contador
-- agregado `views`, que es el total para el dashboard del negocio).
create table story_views (
  story_id uuid not null references stories(id) on delete cascade,
  client_id uuid not null references users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, client_id)
);

alter table subscription_plans add column max_active_stories int;
update subscription_plans set max_active_stories = 0 where name = 'free';
update subscription_plans set max_active_stories = 3 where name = 'standard';
-- pro se queda en null = ilimitado (mismo convenio que max_products/max_services)

-- mismo patron que enforce_catalog_limit (0019_catalog_limit_enforcement.sql)
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

  return new;
end;
$$;

create trigger stories_enforce_limit
before insert on stories
for each row execute function enforce_story_limit();

-- mismo patron que increment_ad_metric (0020_ad_metrics.sql)
create or replace function increment_story_metric(story_id uuid, metric text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if metric = 'view' then
    update stories set views = views + 1 where id = story_id;
  elsif metric = 'click' then
    update stories set clicks = clicks + 1 where id = story_id;
  end if;
end;
$$;

grant execute on function increment_story_metric(uuid, text) to authenticated;

alter table stories enable row level security;

create policy stories_select_visible on stories for select
  using (
    (is_pinned or created_at > now() - interval '24 hours')
    or is_business_staff(business_id)
    or is_admin()
  );
create policy stories_insert_staff on stories for insert with check (is_business_staff(business_id));
create policy stories_update_staff_or_admin on stories for update using (is_business_staff(business_id) or is_admin());
create policy stories_delete_staff_or_admin on stories for delete using (is_business_staff(business_id) or is_admin());

alter table story_views enable row level security;
create policy story_views_select_own on story_views for select using (client_id = auth.uid());
create policy story_views_insert_own on story_views for insert with check (client_id = auth.uid());
