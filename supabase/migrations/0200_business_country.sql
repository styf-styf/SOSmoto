-- Primer paso para que SOSmoto funcione en cualquier país de Latinoamérica
-- hispanohablante -- hoy no existe ninguna columna de país, todo asumía
-- Ecuador implícitamente. Default explícito 'Ecuador' porque el 100% de
-- los negocios existentes son de Ecuador, no se les pide nada nuevo.
alter table businesses add column country text not null default 'Ecuador';
