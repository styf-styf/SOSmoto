-- Corrige 4 privilegios que cualquier miembro del staff tenía a nivel de
-- base de datos aunque la UI ya solo se los mostraba al dueño (isOwner) --
-- alguien que ya es empleado podía llamar la API de Supabase directo con su
-- propia sesión y saltarse ese chequeo de pantalla. Auditoría del equipo
-- 2026-08-03.

-- 1) Editar el perfil del negocio (nombre, dirección, coordenadas, teléfono,
-- WhatsApp, horario, descripción, logo) Y desactivar/reactivar el negocio
-- (is_deactivated, misma columna, mismo policy) -- antes cualquier staff
-- (is_business_staff), ahora solo el dueño. No rompe nada: los 4 lugares de
-- la app que escriben en `businesses` (datos-negocio.tsx, horario.tsx,
-- auxilio-carretera.tsx, configuracion.tsx) ya solo muestran esos controles
-- cuando isOwner.
drop policy if exists businesses_update_staff on businesses;
create policy businesses_update_owner on businesses for update using (is_business_owner(id));

-- 2) KYC: solo el dueño puede enviar o borrar documentos de verificación
-- (cédula/RUC/foto del local) -- involucra documentos de identidad, más
-- sensible que catálogo/chat/posts, y a diferencia de esos no tenía ningún
-- flag can_* dedicado. La lectura se deja igual (is_business_staff, no es
-- lo que se auditó como problema).
drop policy if exists business_verification_requests_insert on business_verification_requests;
create policy business_verification_requests_insert_owner on business_verification_requests for insert with check (
  is_business_owner(business_id)
);

drop policy if exists "kyc_documents_insert_staff" on storage.objects;
create policy "kyc_documents_insert_owner" on storage.objects for insert
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and is_business_owner(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "kyc_documents_delete_staff" on storage.objects;
create policy "kyc_documents_delete_owner" on storage.objects for delete
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and is_business_owner(((storage.foldername(name))[1])::uuid)
  );

-- 4) Invitar o cancelar invitaciones de nuevo personal: solo el dueño --
-- mismo criterio que ya rige para escribir en business_employees en sí
-- (0014_business_employees_management.sql), que quedó sin aplicar acá
-- cuando se agregó la capa de invitaciones en 0056. Antes cualquier staff
-- podía invitar a un tercero con los permisos que quisiera, o cancelar
-- invitaciones que mandó el dueño.
drop policy if exists "inv_insert" on employee_invitations;
create policy "inv_insert_owner" on employee_invitations for insert with check (
  is_business_owner(business_id)
);

drop policy if exists "inv_delete" on employee_invitations;
create policy "inv_delete_owner" on employee_invitations for delete using (
  is_business_owner(business_id) or is_admin()
);
