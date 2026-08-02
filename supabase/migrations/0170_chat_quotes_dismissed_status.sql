-- La X del banner de cotización solo debe cerrarlo de forma permanente en el
-- chat -- NO es lo mismo que "Cancelar" (que sí es una decisión real sobre
-- el producto/servicio cotizado). Sin un estado propio, la única forma de
-- que la X no reapareciera era reusar 'cancelled', mezclando "no quiero
-- verlo más" con "cancelo esta cotización" -- estados distintos que
-- merecen quedar separados por si más adelante se necesita reportar cuántas
-- cotizaciones se cancelaron de verdad vs. solo se dejaron de ver.
alter table chat_quotes drop constraint chat_quotes_status_check;
alter table chat_quotes add constraint chat_quotes_status_check
  check (status in ('pending', 'resolved', 'cancelled', 'dismissed'));
