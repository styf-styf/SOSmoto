-- Vincula un movimiento de stock al cliente que lo causó (venta por apartado
-- confirmado) -- antes no había forma de saber, desde stock_movements, quién
-- compró: solo quedaba el reason='sale' genérico, igual al de una salida
-- manual desde Inventario. Null = movimiento manual (entrada/ajuste/salida
-- sin apartado detrás).
alter table stock_movements add column client_id uuid references users(id) on delete set null;

-- Soporta el historial global (todos los productos del negocio, no uno solo)
-- ordenado por fecha.
create index if not exists stock_movements_business_created_idx
  on stock_movements(business_id, created_at desc);
