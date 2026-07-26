-- FIX CRÍTICO: users_search_clients (migración 0068) dejaba que CUALQUIER
-- usuario autenticado (incluso un cliente) leyera phone/email de cualquier
-- otro cliente, sin exigir ninguna relación (cita, auxilio, compra, etc.)
-- previa con un negocio. Se explotaba desde el buscador de nueva-cita.tsx
-- y desde getClientProfileForBusiness (cliente/[id].tsx).
--
-- El proyecto ya tenía el patrón correcto para esto (users_select_for_appointment
-- en 0016, users_select_for_active_help_request en 0006): una policy de
-- select en `users` scoped por una relación real con el negocio. Lo único
-- que faltaba era extender ese mismo patrón a business_clients, product_intents
-- y service_reports (las 3 relaciones que existen hoy y que 0068 no cubría
-- cuando se escribió, porque business_clients ni siquiera existía todavía).

drop policy if exists users_search_clients on users;

-- Negocio ↔ cliente explícitamente agregado al CRM (business_clients).
create policy users_select_for_business_client on users for select
  using (
    exists (
      select 1 from business_clients bc
      where bc.client_id = users.id and is_business_staff(bc.business_id)
    )
  );

-- Negocio ↔ cliente con un "apartar" de producto (product_intents) --
-- cubre los clientes de tienda que compraron pero nunca se agregaron
-- explícitamente al CRM (Paso 4 de getCRMClientsForStore).
create policy users_select_for_product_intent on users for select
  using (
    exists (
      select 1 from product_intents pi
      where pi.client_id = users.id and is_business_staff(pi.business_id)
    )
  );

-- Negocio ↔ cliente con un informe de servicio (service_reports.client_id) --
-- cubre informes creados sin pasar antes por business_clients/appointments.
create policy users_select_for_service_report on users for select
  using (
    exists (
      select 1 from service_reports sr
      where sr.client_id = users.id and is_business_staff(sr.business_id)
    )
  );

-- Helper: ¿el usuario actual es dueño/empleado de ALGÚN negocio? (no de uno
-- específico, a diferencia de is_business_staff). Necesario para la búsqueda
-- por nombre de abajo, que por diseño busca clientes SIN relación previa
-- (para vincular un cliente nuevo/walk-in) -- no se puede scopear por relación.
create or replace function is_any_business_staff()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from businesses where owner_id = auth.uid())
    or exists (select 1 from business_employees where user_id = auth.uid());
$$;

-- RPC en vez de select directo: fuerza el mínimo de 2 caracteres y el límite
-- de 8 resultados en el servidor (un select directo vía REST podía ignorar
-- el .limit()/.length del lado del cliente), y nunca expone `email`.
-- Restringido a cuentas de negocio (is_any_business_staff) -- antes
-- cualquier cuenta de cliente también podía usarlo para cosechar teléfonos.
create or replace function search_clients_by_name(search_query text)
returns table (id uuid, full_name text, phone text)
language sql
security definer
stable
as $$
  select u.id, u.full_name, u.phone
  from users u
  where u.role = 'client'
    and is_any_business_staff()
    and length(trim(search_query)) >= 2
    and u.full_name ilike '%' || trim(search_query) || '%'
  order by u.full_name
  limit 8;
$$;
