import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Crea el pago pendiente para una campaña de publicidad y devuelve la URL
// del widget de Payphone (en el portal web de Vercel). El registro en `ads`
// solo se crea dentro de payphone-confirm una vez el pago se aprueba -- ver
// la nota en supabase/migrations/0025_ad_payments.sql.
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

const VALID_TYPES = ['home_banner', 'search_featured', 'profile_ad'];

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

    const { businessId, type, title, imageUrl, linkUrl, targetCity, durationDays } = await req.json();
    if (!businessId || !type || !title || !imageUrl || !durationDays) {
      return json({ error: 'Faltan datos' }, 400);
    }
    if (!VALID_TYPES.includes(type)) {
      return json({ error: 'Tipo de anuncio inválido' }, 400);
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
      .select('id, owner_id')
      .eq('id', businessId)
      .single();
    if (businessError || !business || business.owner_id !== userData.user.id) {
      return json({ error: 'No autorizado' }, 403);
    }

    const { data: pricing, error: pricingError } = await supabase
      .from('ad_pricing')
      .select('price_per_day_city, price_per_day_national')
      .eq('ad_type', type)
      .single();
    if (pricingError || !pricing) {
      return json({ error: 'No se pudo calcular el precio' }, 500);
    }

    const isNational = !targetCity;
    const pricePerDay = isNational ? pricing.price_per_day_national : pricing.price_per_day_city;
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
        adType: type,
        title,
        imageUrl,
        linkUrl: linkUrl || null,
        targetCity: targetCity || null,
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
