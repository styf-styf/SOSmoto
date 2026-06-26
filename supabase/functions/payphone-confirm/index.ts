import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYPHONE_TOKEN = Deno.env.get('PAYPHONE_TOKEN')!;
const PAYPHONE_BASE = 'https://pay.payphonetodoesposible.com/api';

Deno.serve(async (req) => {
  try {
    const { id, clientTransactionId } = await req.json();
    if (!id || !clientTransactionId) {
      return new Response(JSON.stringify({ error: 'Faltan datos' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, business_id, plan_id, status')
      .eq('client_transaction_id', clientTransactionId)
      .single();
    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: 'Pago no encontrado' }), { status: 404 });
    }
    if (payment.status === 'completed') {
      return new Response(JSON.stringify({ success: true, alreadyConfirmed: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // V3/Confirm recibe id y clientTransactionId como query params, sin body
    // (igual que el flujo de Cajita de Pagos en producción).
    const confirmUrl = `${PAYPHONE_BASE}/button/V3/Confirm?id=${encodeURIComponent(id)}&clientTransactionId=${encodeURIComponent(clientTransactionId)}`;
    const confirmResponse = await fetch(confirmUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYPHONE_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!confirmResponse.ok) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      const detail = await confirmResponse.text();
      return new Response(JSON.stringify({ error: 'No se pudo confirmar el pago', detail }), { status: 502 });
    }

    const confirmData = await confirmResponse.json();

    if (confirmData.transactionStatus !== 'Approved') {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      return new Response(
        JSON.stringify({ success: false, status: confirmData.transactionStatus }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('payments')
      .update({ status: 'completed', gateway_transaction_id: String(confirmData.transactionId) })
      .eq('id', payment.id);

    if (payment.plan_id) {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await supabase
        .from('business_subscriptions')
        .update({ status: 'expired' })
        .eq('business_id', payment.business_id)
        .eq('status', 'active');

      await supabase.from('business_subscriptions').insert({
        business_id: payment.business_id,
        plan_id: payment.plan_id,
        status: 'active',
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_id: payment.id,
      });

      await supabase.from('businesses').update({ plan_id: payment.plan_id }).eq('id', payment.business_id);
    }

    return new Response(JSON.stringify({ success: true, status: confirmData.transactionStatus }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
