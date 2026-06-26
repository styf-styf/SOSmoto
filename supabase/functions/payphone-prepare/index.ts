import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
    }

    const { businessId, planId } = await req.json();
    if (!businessId || !planId) {
      return new Response(JSON.stringify({ error: 'Faltan datos' }), { status: 400 });
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
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
    }

    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, price_monthly')
      .eq('id', planId)
      .single();
    if (planError || !plan) {
      return new Response(JSON.stringify({ error: 'Plan no encontrado' }), { status: 404 });
    }
    if (plan.price_monthly <= 0) {
      return new Response(JSON.stringify({ error: 'Este plan no requiere pago' }), { status: 400 });
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
      return new Response(JSON.stringify({ error: 'No se pudo crear el pago' }), { status: 500 });
    }

    // El widget de Payphone (Cajita de Pagos) corre en el navegador, no aquí;
    // esta función solo prepara el registro y devuelve la página que lo embebe.
    // La página vive en Vercel (no en Supabase Edge Functions, que fuerza
    // Content-Type: text/plain + CSP sandbox en respuestas HTML).
    const checkoutUrl = `https://so-smoto.vercel.app/api/payphone-checkout?paymentId=${paymentId}`;

    return new Response(JSON.stringify({ paymentId, checkoutUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
