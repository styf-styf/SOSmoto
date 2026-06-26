-- help_requests_business_select/update y help_request_notifications_business_select se
-- consultaban mutuamente dentro de sus propias políticas RLS, causando recursión infinita
-- (error 42P17) al hacer cualquier select/insert sobre help_requests o help_request_notifications.
-- Se envuelven las consultas cruzadas en funciones SECURITY DEFINER (igual que is_business_staff)
-- para que la consulta interna corra como dueño de la tabla y no vuelva a evaluar RLS.

create or replace function public.business_notified_for_request(target_help_request_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from help_request_notifications hrn
    where hrn.help_request_id = target_help_request_id
      and is_business_staff(hrn.business_id)
  );
$$;

create or replace function public.is_own_help_request(target_help_request_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from help_requests hr
    where hr.id = target_help_request_id and hr.client_id = auth.uid()
  );
$$;

drop policy if exists help_requests_business_select on help_requests;
create policy help_requests_business_select on help_requests for select
  using (business_notified_for_request(id));

drop policy if exists help_requests_business_update on help_requests;
create policy help_requests_business_update on help_requests for update
  using (business_notified_for_request(id));

drop policy if exists help_request_notifications_business_select on help_request_notifications;
create policy help_request_notifications_business_select on help_request_notifications for select
  using (is_business_staff(business_id) or is_own_help_request(help_request_id));
