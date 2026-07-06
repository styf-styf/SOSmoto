-- Permite a cualquier usuario autenticado leer vehículos (necesario para que
-- el taller vea los vehículos del cliente en el CRM y en las citas).
-- El negocio ya puede leer datos básicos del usuario (full_name, phone) por
-- políticas anteriores; los vehículos (marca/modelo/año/km) no son más sensibles.
create policy vehicles_select_authenticated on vehicles
  for select
  using (auth.uid() is not null);
