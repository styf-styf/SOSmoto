import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Reenvía una campaña RECHAZADA para otra revisión, sin pasar por Payphone
// de nuevo -- ya se pagó la primera vez y el anuncio nunca llegó a
// mostrarse por el rechazo, así que no es una compra nueva. Alcance, radio
// y duración (lo único que determina el precio, ver ad-prepare) quedan
// intactos -- solo se puede corregir lo que causó el rechazo: contenido
// (texto, fotos, link, item/categoría vinculados). starts_at/ends_at se
// recalculan desde ahora (misma duración ya pagada) para que el negocio no
// pierda días por el tiempo que estuvo esperando revisión y corrigiendo.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: 'No autenticado' }, 401);
    }

    const { adId, kind, categoryId, itemName, productId, serviceId, title, photos, linkUrl, linkLabel } =
      await req.json();
    if (!adId || !kind || !itemName || !title) {
      return json({ error: 'Faltan datos' }, 400);
    }
    if (linkUrl && !linkLabel) {
      return json({ error: 'Falta el texto del botón del link.' }, 400);
    }
    if (kind !== 'product' && kind !== 'service') {
      return json({ error: 'Tipo de anuncio inválido' }, 400);
    }
    if (!Array.isArray(photos) || photos.length === 0 || photos.length > 5) {
      return json({ error: 'Sube al menos una foto para el anuncio.' }, 400);
    }
    if (productId && serviceId) {
      return json({ error: 'Solo puedes vincular un producto o un servicio, no ambos.' }, 400);
    }
    if (kind === 'product' && serviceId) {
      return json({ error: 'Un anuncio de producto no puede vincular un servicio.' }, 400);
    }
    if (kind === 'service' && productId) {
      return json({ error: 'Un anuncio de servicio no puede vincular un producto.' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: ad, error: adError } = await supabase
      .from('ads')
      .select('id, business_id, status, starts_at, ends_at')
      .eq('id', adId)
      .single();
    if (adError || !ad) return json({ error: 'Campaña no encontrada' }, 404);
    if (ad.status !== 'rejected') {
      return json({ error: 'Esta campaña ya no está rechazada.' }, 400);
    }

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, owner_id, is_limited, business_type')
      .eq('id', ad.business_id)
      .single();
    if (businessError || !business || business.owner_id !== userData.user.id) {
      return json({ error: 'No autorizado' }, 403);
    }
    if (business.is_limited) {
      return json({ error: 'Tu negocio está limitado y no puede reenviar campañas.' }, 403);
    }
    if (kind === 'service' && business.business_type !== 'workshop') {
      return json({ error: 'Solo un taller puede anunciar un servicio.' }, 403);
    }

    // Misma validación que ad-prepare: la categoría real del ítem vinculado,
    // nunca la que mande el cliente.
    let resolvedCategoryId: string | null = categoryId || null;
    if (productId) {
      const { data: product } = await supabase.from('products').select('business_id, category_id').eq('id', productId).maybeSingle();
      if (!product || product.business_id !== ad.business_id) {
        return json({ error: 'Ese producto no pertenece a tu negocio.' }, 403);
      }
      resolvedCategoryId = product.category_id;
    }
    if (serviceId) {
      const { data: service } = await supabase.from('services').select('business_id, category_id').eq('id', serviceId).maybeSingle();
      if (!service || service.business_id !== ad.business_id) {
        return json({ error: 'Ese servicio no pertenece a tu negocio.' }, 403);
      }
      resolvedCategoryId = service.category_id;
    }

    // Misma duración ya pagada -- solo se corre la ventana starts/ends a
    // partir de ahora, no se alarga ni se acorta.
    const durationMs = new Date(ad.ends_at).getTime() - new Date(ad.starts_at).getTime();
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + Math.max(durationMs, 0));

    const { data: updated, error: updateError } = await supabase
      .from('ads')
      .update({
        kind,
        product_id: productId || null,
        service_id: serviceId || null,
        category_id: resolvedCategoryId,
        item_name: itemName,
        title,
        photos,
        link_url: linkUrl || null,
        link_label: linkUrl ? linkLabel : null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: 'pending_review',
        rejection_reason: null,
      })
      .eq('id', adId)
      .eq('status', 'rejected')
      .select()
      .single();
    if (updateError) return json({ error: updateError.message }, 500);

    return json({ ad: updated });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
