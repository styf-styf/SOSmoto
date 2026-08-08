-- Sugerencias de mejora que los usuarios del piloto escriben desde la app
-- (Configuración > Enviar sugerencia) -- se leen desde el admin en /piloto,
-- junto con el resto de métricas del lanzamiento. Igual que esa pantalla,
-- es temporal a propósito para el piloto (no hace falta borrar la tabla
-- cuando termine, pero sí quitar la entrada del menú si ya no aplica).
create table pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);
create index pilot_feedback_created_at_idx on pilot_feedback(created_at desc);

alter table pilot_feedback enable row level security;
-- Mismo patrón que reports (0087): cada quien puede mandar la suya y ver
-- las que mandó, nada más -- el admin lee todo por service role.
create policy pilot_feedback_insert_own on pilot_feedback for insert with check (user_id = auth.uid());
create policy pilot_feedback_select_own on pilot_feedback for select using (user_id = auth.uid());
