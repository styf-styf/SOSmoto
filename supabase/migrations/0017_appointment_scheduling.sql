-- Antes el cliente proponía fecha y el negocio solo confirmaba/rechazaba.
-- Ahora el cliente solo pide el servicio (sin fecha); el negocio agenda con su
-- propia fecha/hora a conveniencia, y el cliente aprueba o rechaza esa fecha.
alter type appointment_status add value 'scheduled';

alter table appointments alter column requested_at drop not null;
