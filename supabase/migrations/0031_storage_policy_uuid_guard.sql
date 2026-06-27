-- Bug latente expuesto por 0030_client_stories.sql: las policies de
-- 0021_image_storage.sql castean el primer segmento de la ruta a uuid sin
-- validar el formato. Mientras todo lo que vivía en public-images usaba
-- {business_id}/... (siempre uuid) nunca falló, pero la nueva ruta
-- client-stories/{client_id}/... hace que ese cast reviente con un error de
-- sintaxis (en vez de simplemente negar el permiso), porque Postgres evalúa
-- estas policies aunque el insert/update/delete vaya dirigido a otra policy.
-- Se agrega una guarda de formato antes de castear.
drop policy "public_images_insert_staff" on storage.objects;
drop policy "public_images_update_staff" on storage.objects;
drop policy "public_images_delete_staff" on storage.objects;

create policy "public_images_insert_staff" on storage.objects for insert
  with check (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and is_business_staff(((storage.foldername(name))[1])::uuid)
  );

create policy "public_images_update_staff" on storage.objects for update
  using (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and is_business_staff(((storage.foldername(name))[1])::uuid)
  );

create policy "public_images_delete_staff" on storage.objects for delete
  using (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and is_business_staff(((storage.foldername(name))[1])::uuid)
  );
