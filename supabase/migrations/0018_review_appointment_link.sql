-- Permite vincular una reseña a una cita completada, no solo a un auxilio.
alter table reviews add column appointment_id uuid references appointments(id);
create index idx_reviews_appointment_id on reviews(appointment_id);
