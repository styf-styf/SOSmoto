-- Recomendaciones internas de la plataforma ("Crece tu negocio"): mensajes
-- automaticos de upselling (subir de plan, anunciarse) generados por
-- check-business-growth, no son publicidad pagada ni requieren aprobacion.
create table growth_suggestions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  type text not null check (type in (
    'upgrade_plan_limit_reached',
    'upgrade_plan_near_limit',
    'advertise_low_visibility',
    'advertise_new_business'
  )),
  title text not null,
  body text not null,
  status text not null default 'active' check (status in ('active', 'dismissed')),
  created_at timestamptz not null default now()
);
create index growth_suggestions_business_id_idx on growth_suggestions(business_id);
create index growth_suggestions_business_status_idx on growth_suggestions(business_id, status);

alter table growth_suggestions enable row level security;
create policy growth_suggestions_select_staff on growth_suggestions for select using (is_business_staff(business_id));
create policy growth_suggestions_update_staff on growth_suggestions for update using (is_business_staff(business_id));
