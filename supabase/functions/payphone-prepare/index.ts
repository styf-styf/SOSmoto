import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// El portal web (so-smoto.vercel.app) llama a esta función desde un
// navegador real, que sí aplica CORS (a diferencia de la app nativa o
// curl). Sin estos headers el navegador bloquea la petición antes de
// que llegue y supabase-js solo reporta "Failed to send a request to
// the Edge Function" sin mas detalle.
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

    const { businessId, planId } = await req.json();
    if (!businessId || !planId) {
      return json({ error: 'Faltan datos' }, 400);
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

    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, price_monthly')
      .eq('id', planId)
      .single();
    if (planError || !plan) {
      return json({ error: 'Plan no encontrado' }, 404);
    }
    if (plan.price_monthly <= 0) {
      return json({ error: 'Este plan no requiere pago' }, 400);
    }

    const paymentId = crypto.randomUUID();

    const { error: paymentError } = await supabase.from('payments').insert({
      id: paymentId,
      business_id: businessId,
      amount: plan.price_monthly,
      currency: 'USD',
      type: 'subscription',
      gateway: 'payphone',
      status: 'pending',
      plan_id: plan.id,
      client_transaction_id: paymentId,
    });
    if (paymentError) {
      return json({ error: 'No se pudo crear el pago' }, 500);
    }

    // El widget de Payphone (Cajita de Pagos) corre en el navegador, no aquí;
    // esta función solo prepara el registro y devuelve la página que lo embebe.
    // La página vive en Vercel (no en Supabase Edge Functions, que fuerza
    // Content-Type: text/plain + CSP sandbox en respuestas HTML).
    const checkoutUrl = `https://so-smoto.vercel.app/api/payphone-checkout?paymentId=${paymentId}`;

    return json({ paymentId, checkoutUrl });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
