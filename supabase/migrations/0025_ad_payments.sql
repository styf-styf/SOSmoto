-- Precios de publicidad por tipo de anuncio y alcance. Configurable a futuro
-- desde el Panel de Administración; valores iniciales son un placeholder MVP.
create table ad_pricing (
  ad_type ad_type primary key,
  price_per_day_city numeric(10,2) not null,
  price_per_day_national numeric(10,2) not null
);

insert into ad_pricing (ad_type, price_per_day_city, price_per_day_national) values
  ('home_banner', 1.00, 2.00),
  ('search_featured', 1.50, 3.00),
  ('profile_ad', 1.00, 2.00);

alter table ad_pricing enable row level security;
create policy ad_pricing_select_public on ad_pricing for select using (true);

-- Borrador de la campaña (type, title, image_url, link_url, target_city,
-- duration_days) antes de que el pago se confirme. El registro en `ads` solo
-- se crea dentro de payphone-confirm una vez Payphone aprueba el pago --
-- igual que las suscripciones no crean business_subscriptions hasta
-- confirmar, las campañas pagas no aparecen en la cola de aprobación hasta
-- que el pago esté completo.
alter table payments add column metadata jsonb;
