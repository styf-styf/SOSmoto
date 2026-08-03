-- Bucket público para distribución directa de archivos (ej. el APK de
-- SOSmoto durante el plan piloto, antes de publicar en Google Play/App
-- Store -- ver sección "download" de sosmoto.net). Solo lectura pública;
-- la subida es siempre vía service role (script one-off), nunca desde la
-- app ni por ningún usuario -- por eso no hay policies de insert/update/
-- delete, a diferencia de 'public-images' que sí las tiene para negocios.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'downloads',
  'downloads',
  true,
  200 * 1024 * 1024,
  array['application/vnd.android.package-archive']
)
on conflict (id) do nothing;

create policy "downloads_read" on storage.objects for select
  using (bucket_id = 'downloads');
