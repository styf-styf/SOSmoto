-- FIX MENOR: suspender/limitar una cuenta o negocio no dejaba rastro de qué
-- admin lo hizo ni cuándo (a diferencia del flujo de KYC, que sí guarda
-- reviewed_by/reviewed_at). Con varios admins, no había forma de auditar
-- quién tomó la acción.
alter table users add column if not exists limited_by uuid references users(id);
alter table users add column if not exists limited_at timestamptz;
alter table businesses add column if not exists limited_by uuid references users(id);
alter table businesses add column if not exists limited_at timestamptz;
