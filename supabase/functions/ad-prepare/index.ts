import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Crea el pago pendiente para una campaña de publicidad y devuelve la URL
// del widget de Payphone (en el portal web de Vercel). El registro en `ads`
// solo se crea dentro de payphone-confirm una vez el pago se aprueba -- ver
// la nota en supabase/migrations/0025_ad_payments.sql. La campaña ya no
// tiene un "tipo"/superficie elegida por el negocio (ver
// supabase/migrations/0026_dynamic_ads.sql): se muestra donde sea relevante
// según ciudad, no según una elección manual.
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

    const {
      businessId,
      kind,
      categoryId,
      itemName,
      productId,
      serviceId,
      title,
      photos,
      linkUrl,
      targetScope,
      targetCity,
      targetRadiusKm,
      durationDays,
    } = await req.json();
    if (!businessId || !kind || !itemName || !title || !durationDays) {
      return json({ error: 'Faltan datos' }, 400);
    }
    if (!['national', 'city', 'radius'].includes(targetScope)) {
      return json({ error: 'Alcance inválido' }, 400);
    }
    if (targetScope === 'city' && !targetCity) {
      return json({ error: 'Falta la ciudad para el alcance "Solo tu ciudad".' }, 400);
    }
    let radiusKm: number | null = null;
    if (targetScope === 'radius') {
      radiusKm = Number(targetRadiusKm);
      if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 200) {
        return json({ error: 'El radio debe ser un número entre 1 y 200 km.' }, 400);
      }
    }
    if (kind !== 'product' && kind !== 'service') {
      return json({ error: 'Tipo de anuncio inválido' }, 400);
    }
    if (!Array.isArray(photos) || photos.length === 0 || photos.length > 3) {
      return json({ error: 'Sube entre 1 y 3 fotos para el anuncio.' }, 400);
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
    const days = Number(durationDays);
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      return json({ error: 'Duración inválida' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, owner_id, is_limited, business_type, latitude, longitude')
      .eq('id', businessId)
      .single();
    if (businessError || !business || business.owner_id !== userData.user.id) {
      return json({ error: 'No autorizado' }, 403);
    }
    if (business.is_limited) {
      return json({ error: 'Tu negocio está limitado y no puede crear nuevas campañas de publicidad.' }, 403);
    }
    // Tienda/marca solo anuncia productos -- no ofrecen servicios (ver
    // CLAUDE.md, misma regla que el catálogo).
    if (kind === 'service' && business.business_type !== 'workshop') {
      return json({ error: 'Solo un taller puede anunciar un servicio.' }, 403);
    }

    // Si se vincula un producto/servicio real "ya publicado", confirma que
    // sea del propio negocio -- evita anunciar el catálogo de otro -- y usa
    // SU categoría real (nunca la que mande el cliente) para que quede
    // asignada automáticamente, como corresponde.
    let resolvedCategoryId: string | null = categoryId || null;
    if (productId) {
      const { data: product } = await supabase.from('products').select('business_id, category_id').eq('id', productId).maybeSingle();
      if (!product || product.business_id !== businessId) {
        return json({ error: 'Ese producto no pertenece a tu negocio.' }, 403);
      }
      resolvedCategoryId = product.category_id;
    }
    if (serviceId) {
      const { data: service } = await supabase.from('services').select('business_id, category_id').eq('id', serviceId).maybeSingle();
      if (!service || service.business_id !== businessId) {
        return json({ error: 'Ese servicio no pertenece a tu negocio.' }, 403);
      }
      resolvedCategoryId = service.category_id;
    }

    const { data: pricing, error: pricingError } = await supabase
      .from('ad_pricing')
      .select('price_per_day_city, price_per_day_national, radius_reference_km, radius_cap_km')
      .single();
    if (pricingError || !pricing) {
      return json({ error: 'No se pudo calcular el precio' }, 500);
    }

    // El radio anuncia siempre desde la ubicación real del negocio -- nunca
    // se acepta un lat/lng elegido por el cliente.
    let targetLat: number | null = null;
    let targetLng: number | null = null;
    if (targetScope === 'radius') {
      if (business.latitude == null || business.longitude == null) {
        return json({ error: 'Tu negocio no tiene ubicación configurada -- no puedes usar el alcance por radio.' }, 400);
      }
      targetLat = business.latitude;
      targetLng = business.longitude;
    }

    let pricePerDay: number;
    if (targetScope === 'national') {
      pricePerDay = pricing.price_per_day_national;
    } else if (targetScope === 'city') {
      pricePerDay = pricing.price_per_day_city;
    } else {
      const span = pricing.radius_cap_km - pricing.radius_reference_km;
      const rate = span > 0 ? (pricing.price_per_day_national - pricing.price_per_day_city) / span : 0;
      const base = pricing.price_per_day_city - rate * pricing.radius_reference_km;
      pricePerDay = Math.min(Math.max(base + rate * radiusKm!, 0), pricing.price_per_day_national);
    }
    const amount = Math.round(pricePerDay * days * 100) / 100;

    const paymentId = crypto.randomUUID();
    const { error: paymentError } = await supabase.from('payments').insert({
      id: paymentId,
      business_id: businessId,
      amount,
      currency: 'USD',
      type: 'advertising',
      gateway: 'payphone',
      status: 'pending',
      client_transaction_id: paymentId,
      metadata: {
        kind,
        categoryId: resolvedCategoryId,
        itemName,
        productId: productId || null,
        serviceId: serviceId || null,
        title,
        photos,
        linkUrl: linkUrl || null,
        targetScope,
        targetCity: targetScope === 'city' ? targetCity : null,
        targetLat,
        targetLng,
        targetRadiusKm: targetScope === 'radius' ? radiusKm : null,
        durationDays: days,
      },
    });
    if (paymentError) {
      return json({ error: 'No se pudo crear el pago' }, 500);
    }

    const checkoutUrl = `https://so-smoto.vercel.app/api/payphone-checkout?paymentId=${paymentId}`;
    return json({ paymentId, amount, checkoutUrl });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
