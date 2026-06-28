-- Foto de perfil del cliente: mismo patrón que client-stories/posts
-- (0030/0032), carpeta propia bajo el mismo bucket public-images.
create policy "public_images_insert_avatars" on storage.objects for insert
  with check (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "public_images_delete_avatars" on storage.objects for delete
  using (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
