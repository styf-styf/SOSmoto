-- El taller necesita poder insertar citas al aceptar una solicitud.
create policy appointments_business_insert on appointments for insert
  with check (is_business_staff(business_id));
