import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'public-images';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { image_url } = await req.json() as { image_url: string };
  if (!image_url) {
    return new Response('Missing image_url', { status: 400 });
  }

  // Extrae el path relativo dentro del bucket desde la URL pública.
  // Formato: https://{ref}.supabase.co/storage/v1/object/public/public-images/{path}
  const marker = `/object/public/${BUCKET}/`;
  const markerIndex = image_url.indexOf(marker);
  if (markerIndex === -1) {
    return new Response('URL not from public-images bucket', { status: 400 });
  }
  const storagePath = image_url.slice(markerIndex + marker.length);

  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    console.error('Storage delete error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ deleted: storagePath }), { status: 200 });
});
