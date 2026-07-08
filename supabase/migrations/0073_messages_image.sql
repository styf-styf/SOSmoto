-- Soporte de imágenes en el chat cliente <-> negocio.
-- body sigue siendo not null; cuando el mensaje es solo imagen se envía body = ''.
alter table messages add column image_url text;

-- Storage: cualquier usuario autenticado puede subir sus propias imágenes de chat.
-- Ruta: public-images/chat-images/{sender_id}/{timestamp}.jpg
create policy "public_images_insert_chat" on storage.objects for insert
  with check (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] = 'chat-images'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "public_images_delete_chat" on storage.objects for delete
  using (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] = 'chat-images'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
