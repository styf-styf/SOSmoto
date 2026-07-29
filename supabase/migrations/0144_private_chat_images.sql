-- Fotos de chat vivían en `public-images` (0073_messages_image.sql), el
-- mismo bucket público usado para banners/catálogo/avatares. Al ser
-- `public = true`, Supabase Storage sirve cualquier objeto ahí por su URL
-- pública SIN pasar por RLS -- ni siquiera la policy `messages_select`
-- (que sí scopea correctamente las FILAS de texto) protege las imágenes
-- referenciadas. Cualquiera con la URL (adivinada o filtrada) podía ver la
-- foto de un chat privado. Se crea un bucket nuevo, privado, exclusivo para
-- chat -- las fotos ya enviadas antes de este fix se quedan donde están
-- (siguen funcionando con su URL pública vieja); solo las nuevas usan el
-- bucket privado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images-private', 'chat-images-private', false, 8 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Ruta: {business_id}/{client_id}/{sender_id}-{timestamp}-{suffix}.jpg --
-- con business_id/client_id en la ruta (a diferencia del viejo esquema
-- chat-images/{sender_id}/...), la policy puede verificar que quien lee sea
-- de verdad parte de ESA conversación puntual, sin tener que consultar
-- `messages` fila por fila.
create policy "chat_images_private_insert" on storage.objects for insert
  with check (
    bucket_id = 'chat-images-private'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      is_business_staff(((storage.foldername(name))[1])::uuid)
      or auth.uid() = ((storage.foldername(name))[2])::uuid
    )
  );

create policy "chat_images_private_select" on storage.objects for select
  using (
    bucket_id = 'chat-images-private'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      is_business_staff(((storage.foldername(name))[1])::uuid)
      or auth.uid() = ((storage.foldername(name))[2])::uuid
    )
  );

create policy "chat_images_private_delete" on storage.objects for delete
  using (
    bucket_id = 'chat-images-private'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      is_business_staff(((storage.foldername(name))[1])::uuid)
      or auth.uid() = ((storage.foldername(name))[2])::uuid
    )
  );
