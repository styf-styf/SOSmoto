-- Quién propuso la fecha actual de la cita.
-- 'client': el cliente sugirió fecha (al crear o como contra-propuesta).
-- 'business': el taller propuso o contra-propuso fecha.
-- null: aún no hay fecha propuesta (status = 'pending').
alter table appointments
  add column proposed_by text check (proposed_by in ('client', 'business'));
