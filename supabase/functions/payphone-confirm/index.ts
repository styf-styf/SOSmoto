import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYPHONE_TOKEN = Deno.env.get('PAYPHONE_TOKEN')!;
// Endpoint real de confirmación de la Cajita de Pagos (Payment Box), según
// la documentación oficial (docs.payphone.app/cajita-de-pagos-payphone) --
// NO es el mismo que "Botón de Pago por redirección" (pay.../button/V3/Confirm,
// con query params). Es un producto distinto de Payphone, con su propio
// endpoint (paymentbox.../api/confirm) y su propio formato de body (JSON,
// campo "clientTxId" no "clientTransactionId", "id" numérico no string en la
// URL). Confundir los dos hacía que CADA confirmación fallara -- no era un
// bug de Payphone, era el endpoint equivocado para nuestro widget.
const PAYPHONE_CONFIRM_URL = 'https://paymentbox.payphonetodoesposible.com/api/confirm';

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
    kind: m.kind,
    category_id: m.categoryId ?? null,
    item_name: m.itemName,
    product_id: m.productId ?? null,
    service_id: m.serviceId ?? null,
    title: m.title,
    photos: m.photos ?? [],
    link_url: m.linkUrl ?? null,
    link_label: m.linkLabel ?? null,
    target_city: m.targetCity ?? null,
    target_scope: m.targetScope ?? 'national',
    target_lat: m.targetLat ?? null,
    target_lng: m.targetLng ?? null,
    target_radius_km: m.targetRadiusKm ?? null,
    status: 'pending_review',
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    payment_id: payment.id,
  });

  // Si el anuncio se ancló a un producto/servicio ya publicado que todavía
  // no tenía ninguna foto propia, se le copian las del anuncio -- sin esto,
  // el botón "Ver producto/servicio" del anuncio llevaba a una ficha vacía
  // de fotos aunque el anuncio sí mostrara una.
  const photos = Array.isArray(m.photos) ? m.photos : [];
  if (photos.length > 0 && m.productId) {
    const { data: product } = await supabase.from('products').select('photos').eq('id', m.productId).maybeSingle();
    if (product && (!product.photos || product.photos.length === 0)) {
      await supabase.from('products').update({ photos }).eq('id', m.productId);
    }
  } else if (photos.length > 0 && m.serviceId) {
    const { data: service } = await supabase.from('services').select('photos').eq('id', m.serviceId).maybeSingle();
    if (service && (!service.photos || service.photos.length === 0)) {
      await supabase.from('services').update({ photos }).eq('id', m.serviceId);
    }
  }
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

    const confirmResponse = await fetch(PAYPHONE_CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYPHONE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: Number(id), clientTxId: clientTransactionId }),
    });

    if (!confirmResponse.ok) {
      const detail = await confirmResponse.text();
      console.error('payphone confirm not ok', confirmResponse.status, detail);

      // Si quien nos llama (el webhook de Payphone, no el navegador) ya nos
      // dijo 'Approved', confiamos en eso en vez de bloquear al negocio --
      // pero con el endpoint/formato correctos, esta rama ya no debería
      // activarse en el camino feliz.
      if (hintedStatus === 'Approved') {
        console.warn('Confirm fallo pero transactionStatus=Approved fue confirmado por el webhook; activando de todas formas', { id, clientTransactionId });
        await fulfillPayment(supabase, payment as PaymentRow, id);
        return new Response(
          JSON.stringify({ success: true, status: 'Approved', note: 'Confirm fallo, activado por transactionStatus del webhook' }),
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
