-- Última ubicación conocida del cliente (país/región/ciudad, a partir de
-- reverse-geocoding del GPS que ya se pide en Inicio) -- exclusivamente
-- para métricas internas del admin, nunca se muestra en la app. A
-- propósito NO se toca el `grant select (...)` de 0155 -- en Postgres, una
-- columna nueva no se agrega sola a un grant de columnas ya enumeradas, así
-- que estas 4 quedan automáticamente inaccesibles vía select para
-- authenticated/anon (mismo tratamiento que ya recibe push_token). Solo
-- service_role (admin) las puede leer. El UPDATE sí sigue permitido vía
-- users_update_own (0002, sin restricción de columna) -- el peor caso de
-- que alguien falsee su propio país/ciudad es ruido menor en una métrica
-- interna, no una filtración de datos ajenos.
alter table users
  add column last_location_country text,
  add column last_location_region text,
  add column last_location_city text,
  add column last_location_updated_at timestamptz;
