-- Habilitar RLS en todas las tablas
alter table users enable row level security;
alter table vehicles enable row level security;
alter table businesses enable row level security;
alter table business_employees enable row level security;
alter table subscription_plans enable row level security;
alter table business_subscriptions enable row level security;
alter table services enable row level security;
alter table products enable row level security;
alter table help_requests enable row level security;
alter table help_request_notifications enable row level security;
alter table reviews enable row level security;
alter table ads enable row level security;
alter table payments enable row level security;
alter table maintenance_rules enable row level security;
alter table maintenance_suggestions enable row level security;
alter table follows enable row level security;

-- Helper: ¿el usuario actual es dueño/empleado con permiso del negocio?
create or replace function is_business_owner(target_business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from businesses
    where id = target_business_id and owner_id = auth.uid()
  );
$$;

create or replace function is_business_staff(target_business_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from businesses where id = target_business_id and owner_id = auth.uid()
  ) or exists (
    select 1 from business_employees
    where business_id = target_business_id and user_id = auth.uid()
  );
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from users where id = auth.uid() and role = 'admin');
$$;

-- users: cada usuario ve/edita su propio registro; admin ve todos
create policy users_select_own on users for select using (id = auth.uid() or is_admin());
create policy users_update_own on users for update using (id = auth.uid());
create policy users_insert_own on users for insert with check (id = auth.uid());

-- vehicles: solo el dueño del vehículo
create policy vehicles_owner_all on vehicles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- businesses: lectura pública, escritura solo dueño/staff
create policy businesses_select_public on businesses for select using (true);
create policy businesses_insert_owner on businesses for insert with check (owner_id = auth.uid());
create policy businesses_update_staff on businesses for update using (is_business_staff(id));
create policy businesses_delete_owner on businesses for delete using (owner_id = auth.uid());

-- business_employees: visible y gestionable solo por staff del negocio
create policy business_employees_staff_all on business_employees for all
  using (is_business_staff(business_id))
  with check (is_business_staff(business_id));

-- subscription_plans: lectura pública, solo admin modifica
create policy subscription_plans_select_public on subscription_plans for select using (true);
create policy subscription_plans_admin_write on subscription_plans for all
  using (is_admin()) with check (is_admin());

-- business_subscriptions: staff del negocio o admin
create policy business_subscriptions_staff_select on business_subscriptions for select
  using (is_business_staff(business_id) or is_admin());
create policy business_subscriptions_admin_write on business_subscriptions for insert
  with check (is_admin());
create policy business_subscriptions_admin_update on business_subscriptions for update
  using (is_admin());

-- services / products: lectura pública, escritura solo staff del negocio
create policy services_select_public on services for select using (true);
create policy services_staff_write on services for all
  using (is_business_staff(business_id))
  with check (is_business_staff(business_id));

create policy products_select_public on products for select using (true);
create policy products_staff_write on products for all
  using (is_business_staff(business_id))
  with check (is_business_staff(business_id));

-- help_requests: el cliente ve/crea las suyas; negocios staff ven las que les fueron notificadas
create policy help_requests_client_all on help_requests for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

create policy help_requests_business_select on help_requests for select
  using (
    exists (
      select 1 from help_request_notifications hrn
      where hrn.help_request_id = help_requests.id
        and is_business_staff(hrn.business_id)
    )
  );

create policy help_requests_business_update on help_requests for update
  using (
    exists (
      select 1 from help_request_notifications hrn
      where hrn.help_request_id = help_requests.id
        and is_business_staff(hrn.business_id)
    )
  );

-- help_request_notifications: visibles solo para el negocio notificado o el cliente dueño de la solicitud
create policy help_request_notifications_business_select on help_request_notifications for select
  using (
    is_business_staff(business_id)
    or exists (
      select 1 from help_requests hr
      where hr.id = help_request_notifications.help_request_id and hr.client_id = auth.uid()
    )
  );

create policy help_request_notifications_business_update on help_request_notifications for update
  using (is_business_staff(business_id));

-- reviews: públicas si is_public, autor siempre ve la propia; negocio ve reviews internas sobre él (fase 2)
create policy reviews_select_public on reviews for select
  using (
    is_public = true
    or reviewer_id = auth.uid()
    or (reviewed_business_id is not null and is_business_staff(reviewed_business_id))
  );

create policy reviews_insert_own on reviews for insert with check (reviewer_id = auth.uid());
create policy reviews_update_own on reviews for update using (reviewer_id = auth.uid());
create policy reviews_delete_own on reviews for delete using (reviewer_id = auth.uid());

-- ads: el negocio ve/gestiona las suyas; cualquiera puede ver las aprobadas/activas; admin ve todas
create policy ads_select_active on ads for select
  using (status in ('approved', 'active') or is_business_staff(business_id) or is_admin());
create policy ads_insert_staff on ads for insert with check (is_business_staff(business_id));
create policy ads_update_staff_or_admin on ads for update
  using (is_business_staff(business_id) or is_admin());

-- payments: solo staff del negocio dueño o admin
create policy payments_select_staff on payments for select
  using (is_business_staff(business_id) or is_admin());
create policy payments_insert_staff on payments for insert with check (is_business_staff(business_id));
create policy payments_admin_update on payments for update using (is_admin());

-- maintenance_rules: lectura pública, solo admin modifica
create policy maintenance_rules_select_public on maintenance_rules for select using (true);
create policy maintenance_rules_admin_write on maintenance_rules for all
  using (is_admin()) with check (is_admin());

-- maintenance_suggestions: solo el dueño del vehículo
create policy maintenance_suggestions_owner_select on maintenance_suggestions for select
  using (
    exists (select 1 from vehicles v where v.id = maintenance_suggestions.vehicle_id and v.user_id = auth.uid())
  );
create policy maintenance_suggestions_owner_update on maintenance_suggestions for update
  using (
    exists (select 1 from vehicles v where v.id = maintenance_suggestions.vehicle_id and v.user_id = auth.uid())
  );

-- follows: el cliente gestiona sus propios follows; el negocio puede ver quién lo sigue
create policy follows_client_all on follows for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

create policy follows_business_select on follows for select
  using (is_business_staff(business_id));
