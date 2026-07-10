-- Configuración global de la plataforma, editable desde el admin
-- (Configuración > Reglas del sistema). Fila única, mismo patrón que
-- ad_pricing (0026_dynamic_ads.sql).
create table system_settings (
  id boolean primary key default true check (id),
  default_aid_radius_km int not null default 5
);
insert into system_settings (id, default_aid_radius_km) values (true, 5);

alter table system_settings enable row level security;
create policy system_settings_select_public on system_settings for select using (true);
