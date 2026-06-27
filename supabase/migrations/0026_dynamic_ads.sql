-- Las campañas de publicidad dejan de estar amarradas a un solo tipo
-- (home_banner / search_featured / profile_ad) elegido por el negocio: una
-- campaña activa ahora es elegible para mostrarse en cualquier superficie
-- relevante (inicio, búsqueda, perfiles) según la app, no según una
-- elección manual al crearla.
alter table ads drop column type;

drop policy if exists ad_pricing_select_public on ad_pricing;
drop table ad_pricing;
drop type if exists ad_type;

create table ad_pricing (
  id boolean primary key default true check (id),
  price_per_day_city numeric(10,2) not null,
  price_per_day_national numeric(10,2) not null
);
insert into ad_pricing (id, price_per_day_city, price_per_day_national) values (true, 1.50, 3.00);

alter table ad_pricing enable row level security;
create policy ad_pricing_select_public on ad_pricing for select using (true);
