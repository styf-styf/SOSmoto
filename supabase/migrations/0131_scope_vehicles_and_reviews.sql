-- FIX CRÍTICO: vehicles_select_authenticated (0063) dejaba leer marca,
-- modelo, año, kilometraje y PLACA de CUALQUIER vehículo de CUALQUIER
-- usuario, con solo estar autenticado -- sin ninguna relación real con el
-- dueño. Se reemplaza por el mismo patrón scoped-por-relación ya usado para
-- `users` (business_clients aceptado, appointments, help_requests,
-- product_intents, service_reports).
drop policy if exists vehicles_select_authenticated on vehicles;

create policy vehicles_select_for_related_business on vehicles for select
  using (
    exists (
      select 1 from business_clients bc
      where bc.client_id = vehicles.user_id and bc.status = 'accepted' and is_business_staff(bc.business_id)
    )
    or exists (
      select 1 from appointments a
      where a.client_id = vehicles.user_id and is_business_staff(a.business_id)
    )
    or exists (
      select 1 from help_requests hr
      join help_request_notifications hrn on hrn.help_request_id = hr.id
      where hr.client_id = vehicles.user_id and is_business_staff(hrn.business_id)
    )
    or exists (
      select 1 from product_intents pi
      where pi.client_id = vehicles.user_id and is_business_staff(pi.business_id)
    )
    or exists (
      select 1 from service_reports sr
      where sr.client_id = vehicles.user_id and is_business_staff(sr.business_id)
    )
  );

-- FIX CRÍTICO: reviews_insert_own/reviews_update_own (0002) solo exigían
-- reviewer_id = auth.uid() -- nada impedía que un cliente, dueño de una
-- reseña pública legítima, la reescribiera después (o la insertara desde
-- el inicio) apuntando a reviewed_client_id en vez de reviewed_business_id
-- con is_public en true. La regla del MVP (solo cliente→negocio es pública;
-- negocio→cliente siempre interna) estaba solo en services/reviews.ts
-- (createClientReview hardcodea is_public: false), nunca en el backend.
--
-- FIX IMPORTANTE (mismo archivo, hallazgo relacionado): tampoco se exigía
-- ninguna interacción real (help_request/appointment/product_intent)
-- completada con ese negocio -- un cliente podía review-bombear cualquier
-- negocio con 1 estrella sin haber interactuado nunca, y esto sí afecta
-- rating_avg (factor de ranking de búsqueda). Se agrega la verificación de
-- que la interacción referenciada exista, sea del propio reviewer, apunte
-- al mismo negocio, y esté en estado terminal (completed/sold) -- más un
-- índice único por interacción para que no se puedan duplicar reseñas del
-- mismo auxilio/cita/compra.
create or replace function review_interaction_valid(
  p_business_id uuid,
  p_help_request_id uuid,
  p_appointment_id uuid,
  p_product_intent_id uuid
)
returns boolean
language sql
security definer
stable
as $$
  select
    (p_help_request_id is not null and exists (
      select 1 from help_requests hr
      where hr.id = p_help_request_id and hr.client_id = auth.uid()
        and hr.accepted_business_id = p_business_id and hr.status = 'completed'
    ))
    or (p_appointment_id is not null and exists (
      select 1 from appointments a
      where a.id = p_appointment_id and a.client_id = auth.uid()
        and a.business_id = p_business_id and a.status = 'completed'
    ))
    or (p_product_intent_id is not null and exists (
      select 1 from product_intents pi
      where pi.id = p_product_intent_id and pi.client_id = auth.uid()
        and pi.business_id = p_business_id and pi.status = 'sold'
    ));
$$;

drop policy if exists reviews_insert_own on reviews;
create policy reviews_insert_own on reviews for insert
  with check (
    reviewer_id = auth.uid()
    and (
      (
        reviewed_business_id is not null and reviewed_client_id is null and is_public = true
        and review_interaction_valid(reviewed_business_id, help_request_id, appointment_id, product_intent_id)
      )
      or (reviewed_client_id is not null and reviewed_business_id is null and is_public = false)
    )
  );

drop policy if exists reviews_update_own on reviews;
create policy reviews_update_own on reviews for update
  using (reviewer_id = auth.uid())
  with check (
    reviewer_id = auth.uid()
    and (
      (
        reviewed_business_id is not null and reviewed_client_id is null and is_public = true
        and review_interaction_valid(reviewed_business_id, help_request_id, appointment_id, product_intent_id)
      )
      or (reviewed_client_id is not null and reviewed_business_id is null and is_public = false)
    )
  );

-- Evita duplicar reseñas del mismo auxilio/cita/compra ya reseñado.
create unique index if not exists reviews_unique_help_request
  on reviews(reviewer_id, help_request_id) where help_request_id is not null;
create unique index if not exists reviews_unique_appointment
  on reviews(reviewer_id, appointment_id) where appointment_id is not null;
create unique index if not exists reviews_unique_product_intent
  on reviews(reviewer_id, product_intent_id) where product_intent_id is not null;
