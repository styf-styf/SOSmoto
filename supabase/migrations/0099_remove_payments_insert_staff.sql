-- payments_insert_staff dejaba que cualquier empleado del negocio insertara
-- una fila arbitraria en payments (status 'completed', monto, gateway, etc.)
-- directo via el SDK -- sin escalar privilegios (plan/verificado estan
-- protegidos aparte por el trigger de 0088), pero permitia falsear el
-- historial de pagos. Los pagos reales SIEMPRE se crean desde Edge
-- Functions con service role (ad-prepare, payphone-prepare), que bypasean
-- RLS por completo -- ningun flujo legitimo del cliente necesita insertar
-- en payments directo, asi que se quita la politica en vez de acotarla.
drop policy if exists payments_insert_staff on payments;
