-- Hasta ahora vistas/clics de catalogo, anuncios e historias eran solo
-- contadores (products.views, services.views, ads.impressions/clicks,
-- stories.views/clicks) -- no habia forma de saber CUANDO paso cada uno,
-- asi que el dashboard no podia filtrar por periodo ni mostrar tendencia
-- para esas metricas. Esta tabla registra cada evento con fecha; las
-- funciones que ya incrementaban el contador ahora TAMBIEN insertan acá,
-- en la misma transaccion (mismo patron ya usado por otras funciones
-- security definer del proyecto).
create table business_metric_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  metric text not null check (metric in ('product_view', 'service_view', 'ad_impression', 'ad_click', 'story_click')),
  entity_id uuid,
  created_at timestamptz not null default now()
);
create index business_metric_events_lookup_idx on business_metric_events(business_id, metric, created_at);

alter table business_metric_events enable row level security;
-- Solo lectura para el propio negocio (dashboard) -- ninguna policy de
-- insert/update/delete para authenticated/anon a proposito: solo las
-- funciones security definer de abajo escriben acá.
create policy business_metric_events_select_staff on business_metric_events for select
  using (is_business_staff(business_id));

create or replace function increment_catalog_views(item_id uuid, item_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  if item_type = 'product' then
    update products set views = views + 1 where id = item_id returning business_id into v_business_id;
    if v_business_id is not null then
      insert into business_metric_events (business_id, metric, entity_id) values (v_business_id, 'product_view', item_id);
    end if;
  elsif item_type = 'service' then
    update services set views = views + 1 where id = item_id returning business_id into v_business_id;
    if v_business_id is not null then
      insert into business_metric_events (business_id, metric, entity_id) values (v_business_id, 'service_view', item_id);
    end if;
  end if;
end;
$$;

create or replace function increment_ad_metric(ad_id uuid, metric text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  if metric = 'impression' then
    update ads set impressions = impressions + 1 where id = ad_id returning business_id into v_business_id;
    if v_business_id is not null then
      insert into business_metric_events (business_id, metric, entity_id) values (v_business_id, 'ad_impression', ad_id);
    end if;
  elsif metric = 'click' then
    update ads set clicks = clicks + 1 where id = ad_id returning business_id into v_business_id;
    if v_business_id is not null then
      insert into business_metric_events (business_id, metric, entity_id) values (v_business_id, 'ad_click', ad_id);
    end if;
  end if;
end;
$$;

create or replace function increment_story_metric(story_id uuid, metric text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  if metric = 'view' then
    update stories set views = views + 1 where id = story_id;
    -- las vistas de historia ya se registran con fecha en story_views
    -- (upsert por cliente, ver 0028_stories.sql) -- no hace falta duplicar acá.
  elsif metric = 'click' then
    update stories set clicks = clicks + 1 where id = story_id returning business_id into v_business_id;
    if v_business_id is not null then
      insert into business_metric_events (business_id, metric, entity_id) values (v_business_id, 'story_click', story_id);
    end if;
  end if;
end;
$$;
