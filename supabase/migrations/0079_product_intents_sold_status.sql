-- Nuevos estados para el flujo de venta de tienda: 'sold' (venta concretada,
-- dispara pedido de calificación al cliente) y dos variantes de cancelación
-- para distinguir el motivo (uso futuro: detectar clientes que no se
-- presentan) sin cambiar la UI, que sigue mostrando "Cancelado" en ambos casos.
alter type product_intent_status add value 'sold';
alter type product_intent_status add value 'cancelled_by_client';
alter type product_intent_status add value 'cancelled_no_show';
