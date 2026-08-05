-- Contador de "veces que se renderizó un mapa" (Google Maps SDK) -- no
-- existía ningún dato sobre esto, y es el consumo que más probablemente
-- agota el cupo gratis de Google Maps (10,000 llamadas/mes por API desde
-- marzo 2025). Solo pantalla + fecha, nada de ubicación ni usuario -- basta
-- para saber qué pantalla consume más sin guardar datos sensibles.
create table map_loads (
  id uuid primary key default gen_random_uuid(),
  screen text not null,
  created_at timestamptz not null default now()
);
create index map_loads_screen_created_idx on map_loads(screen, created_at);

alter table map_loads enable row level security;
-- Deny-all a propósito -- se llena solo vía log_map_load() (security
-- definer), igual que apk_downloads. Ni el cliente ni el negocio pueden
-- leer/escribir esta tabla directo.

create or replace function log_map_load(p_screen text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into map_loads (screen) values (p_screen);
end;
$$;

grant execute on function log_map_load(text) to authenticated;
