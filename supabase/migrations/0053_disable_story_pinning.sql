-- Desactiva temporalmente "fijar historia como destacado permanente": las
-- historias fijadas se quedaban visibles para siempre sin ningun aviso claro
-- al negocio de que ya no iban a expirar. Se apaga la funcion (UI ya
-- deshabilitada en app/(business)/historias.tsx) y se "despinea" todo lo
-- existente para que vuelva a aplicar la expiracion normal de 24h.
-- No se borra la columna ni la logica de RLS/filtros -- son faciles de
-- reactivar (basta con quitar este constraint) cuando se mejore o se
-- decida quitar la funcion definitivamente.

update stories set is_pinned = false where is_pinned = true;

alter table stories
  add constraint stories_pinning_disabled check (is_pinned = false);
