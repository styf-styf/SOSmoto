-- FIX IMPORTANTE: ningún bucket tenía file_size_limit ni allowed_mime_types
-- -- la compresión/redimensión (optimizeImage en services/storage.ts) era
-- responsabilidad exclusiva del cliente. Quien llamara la API de Storage
-- directo, con un JWT válido y una ruta dentro de su propia carpeta, podía
-- subir archivos arbitrariamente grandes o de otro tipo.
update storage.buckets
set file_size_limit = 8 * 1024 * 1024, -- 8 MB, generoso para una foto de celular ya comprimida
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'public-images';

update storage.buckets
set file_size_limit = 15 * 1024 * 1024, -- documentos de identidad, permite PDF/fotos de mayor resolución
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'kyc-documents';
