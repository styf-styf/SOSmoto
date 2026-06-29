import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYPHONE_TOKEN = Deno.env.get('PAYPHONE_TOKEN')!;
const PAYPHONE_BASE = 'https://pay.payphonetodoesposible.com/api';

type PaymentRow = {
  id: string;
  business_id: string;
  plan_id: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
};

const PLAN_LABEL: Record<string, string> = { free: 'Free', standard: 'Estándar', pro: 'Pro' };

async function sendPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data }),
  });
}

async function notifyPlanChanged(supabase: ReturnType<typeof createClient>, businessId: string, planId: string) {
  const [{ data: business }, { data: plan }] = await Promise.all([
    supabase.from('businesses').select('owner_id').eq('id', businessId).maybeSingle(),
    supabase.from('subscription_plans').select('name').eq('id', planId).maybeSingle(),
  ]);
  if (!business?.owner_id || !plan?.name) return;

  const { data: owner } = await supabase.from('users').select('push_token').eq('id', business.owner_id).maybeSingle();
  if (!owner?.push_token) return;

  await sendPush(
    owner.push_token,
    'Plan actualizado',
    `Tu negocio ahora tiene el plan ${PLAN_LABEL[plan.name as string] ?? plan.name}.`,
    { type: 'plan_changed', businessId }
  );
}

async function activateSubscription(supabase: ReturnType<typeof createClient>, payment: PaymentRow) {
  if (!payment.plan_id) return;
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

  await notifyPlanChanged(supabase, payment.business_id, payment.plan_id);
}

// La campaña recién se crea aquí, no antes -- el borrador vive en
// payments.metadata hasta que el pago se confirma. Queda en
// 'pending_review' para que el admin la apruebe antes de mostrarse a
// clientes (ver supabase/migrations/0025_ad_payments.sql).
async function createAdFromPayment(supabase: ReturnType<typeof createClient>, payment: PaymentRow) {
  const m = payment.metadata;
  if (!m) return;
  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + Number(m.durationDays));

  await supabase.from('ads').insert({
    business_id: payment.business_id,
    title: m.title,
    image_url: m.imageUrl,
    link_url: m.linkUrl ?? null,
    target_city: m.targetCity ?? null,
    status: 'pending_review',
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    payment_id: payment.id,
  });
}

async function fulfillPayment(
  supabase: ReturnType<typeof createClient>,
  payment: PaymentRow,
  gatewayTransactionId: string
) {
  await supabase
    .from('payments')
    .update({ status: 'completed', gateway_transaction_id: gatewayTransactionId })
    .eq('id', payment.id);

  if (payment.type === 'advertising') {
    await createAdFromPayment(supabase, payment);
  } else {
    await activateSubscription(supabase, payment);
  }
}

Deno.serve(async (req) => {
  try {
    const { id, clientTransactionId, transactionStatus: hintedStatus } = await req.json();
    if (!id || !clientTransactionId) {
      return new Response(JSON.stringify({ error: 'Faltan datos' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, business_id, plan_id, status, type, metadata')
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
      const detail = await confirmResponse.text();
      console.error('payphone V3/Confirm not ok', confirmResponse.status, detail);

      // Bug confirmado de Payphone: V3/Confirm devuelve un error generico de
      // IIS/ASP.NET (no JSON) para transacciones reales completadas vía el
      // handoff a la app nativa de Payphone -- el cobro SI se hizo, solo su
      // endpoint de verificacion revienta. Si quien nos llama (el webhook de
      // Payphone, no el navegador) ya nos dijo 'Approved', confiamos en eso
      // en vez de bloquear al negocio por un bug del lado de Payphone.
      if (hintedStatus === 'Approved') {
        console.warn('V3/Confirm fallo pero transactionStatus=Approved fue confirmado por el webhook; activando de todas formas', { id, clientTransactionId });
        await fulfillPayment(supabase, payment as PaymentRow, id);
        return new Response(
          JSON.stringify({ success: true, status: 'Approved', note: 'V3/Confirm fallo, activado por transactionStatus del webhook' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo confirmar el pago', httpStatus: confirmResponse.status, detail }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const confirmData = await confirmResponse.json();

    if (confirmData.transactionStatus !== 'Approved') {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      console.error('payphone transaction not approved', confirmData);
      return new Response(
        JSON.stringify({ success: false, status: confirmData.transactionStatus, confirmData }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    await fulfillPayment(supabase, payment as PaymentRow, String(confirmData.transactionId));

    return new Response(JSON.stringify({ success: true, status: confirmData.transactionStatus }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
