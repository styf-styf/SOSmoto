-- Tercera opcion de alcance para publicidad: radio de distancia, ademas de
-- ciudad y nacional. El punto de origen del radio es siempre la ubicacion
-- real del negocio (businesses.latitude/longitude) -- el negocio no elige un
-- punto en el mapa, solo el radio en km, mismo patron que aid_radius_km en
-- auxilio en carretera.
alter table ads add column target_scope text not null default 'national'
  check (target_scope in ('national', 'city', 'radius'));
alter table ads add column target_lat double precision;
alter table ads add column target_lng double precision;
alter table ads add column target_radius_km integer;

update ads set target_scope = case when target_city is null then 'national' else 'city' end;

-- El radio no tiene un precio propio fijado por el admin -- se interpola
-- linealmente entre price_per_day_city y price_per_day_national usando dos
-- anclas en KM (no en dolares): a radius_reference_km cuesta lo mismo que
-- "Ciudad", a radius_cap_km (o mas) cuesta lo mismo que "Nacional" (tope).
-- Guardar las anclas en KM en vez de precios en dolares hace que la formula
-- se siga ajustando sola si el admin cambia las tarifas de ciudad/nacional
-- despues, sin tener que resincronizar nada a mano.
alter table ad_pricing add column radius_reference_km integer not null default 40;
alter table ad_pricing add column radius_cap_km integer not null default 100;
