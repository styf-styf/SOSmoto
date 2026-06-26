-- Bucket público para imágenes de negocios (banners de publicidad y fotos de
-- catálogo). Convención de ruta: public-images/{business_id}/{archivo} — así
-- is_business_staff(business_id) sirve también para las policies de Storage.
insert into storage.buckets (id, name, public)
values ('public-images', 'public-images', true)
on conflict (id) do nothing;

create policy "public_images_read" on storage.objects for select
  using (bucket_id = 'public-images');

create policy "public_images_insert_staff" on storage.objects for insert
  with check (
    bucket_id = 'public-images'
    and is_business_staff(((storage.foldername(name))[1])::uuid)
  );

create policy "public_images_update_staff" on storage.objects for update
  using (
    bucket_id = 'public-images'
    and is_business_staff(((storage.foldername(name))[1])::uuid)
  );

create policy "public_images_delete_staff" on storage.objects for delete
  using (
    bucket_id = 'public-images'
    and is_business_staff(((storage.foldername(name))[1])::uuid)
  );
