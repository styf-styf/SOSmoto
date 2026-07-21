-- Un anuncio rechazado no explicaba por qué ni dejaba corregir y reenviar
-- (auditoría UX, negocio/medio) -- el admin solo cambiaba status a
-- 'rejected' sin dejar ningún rastro de la razón. El negocio puede leerla en
-- publicidad.tsx y usar el mismo flujo de "Relanzar" (ver handleRelaunch)
-- para corregir y volver a pagar.
alter table ads add column rejection_reason text;
