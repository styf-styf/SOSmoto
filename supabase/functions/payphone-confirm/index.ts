import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { appButton, escapeHtml, sendEmail } from '../_shared/resend.ts';

const PAYPHONE_TOKEN = Deno.env.get('PAYPHONE_TOKEN')!;
// Único llamador legítimo de esta función es web/api/payphone-return.js
// (server-side, nunca el navegador ni la app) -- pero ese caller solo tenía
// la anon key pública como Authorization (necesaria para pasar el gate de
// plataforma de Supabase, ver check-maintenance), lo que en la práctica
// significaba que CUALQUIERA con la anon key (viene en el bundle de la app y
// en el JS del portal web) podía invocar esta función directo con cualquier
// id/clientTransactionId. No confirma nada gratis (sigue re-verificando con
// Payphone antes de activar algo), pero permitía enumerar/forzar llamadas
// pagas a la API de Payphone sin ser el dueño del pago. Se agrega un secreto
// compartido server-to-server (nunca expuesto al cliente) que solo
// payphone-return.js conoce.
const PAYPHONE_CONFIRM_SECRET = Deno.env.get('PAYPHONE_CONFIRM_SECRET')!;
// Endpoint real de confirmación de la Cajita de Pagos (Payment Box), según
// la documentación oficial (docs.payphone.app/cajita-de-pagos-payphone) --
// NO es el mismo que "Botón de Pago por redirección" (pay.../button/V3/Confirm,
// con query params). Es un producto distinto de Payphone, con su propio
// endpoint (paymentbox.../api/confirm) y su propio formato de body (JSON,
// campo "clientTxId" no "clientTransactionId", "id" numérico no string en la
// URL). Confundir los dos hacía que CADA confirmación fallara -- no era un
// bug de Payphone, era el endpoint equivocado para nuestro widget.
const PAYPHONE_CONFIRM_URL = 'https://paymentbox.payphonetodoesposible.com/api/confirm';

// Publicidad está desactivada para el lanzamiento (ver constants/features.ts
// en la app -- duplicado acá igual que en ad-prepare/ad-resubmit/
// check-business-growth). ad-prepare ya no deja crear pagos nuevos de tipo
// 'advertising' mientras esto sea false, pero un pago pendiente creado
// ANTES de apagar el flag podía quedar abierto y confirmarse más tarde --
// esto evita cobrarlo y crear el anuncio en ese caso.
const ADS_ENABLED = false;

type PaymentRow = {
  id: string;
  business_id: string;
  plan_id: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
  amount: number;
  client_transaction_id: string;
};

const PLAN_LABEL: Record<string, string> = { free: 'Free', standard: 'Estándar', pro: 'Pro' };

async function sendPush(token: string, title: string, body: string, data: Record<string, unknown>) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data }),
  });
}

async function notifyPlanChanged(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  planId: string,
  expiresAt: Date
) {
  const [{ data: business }, { data: plan }] = await Promise.all([
    supabase.from('businesses').select('owner_id, name').eq('id', businessId).maybeSingle(),
    supabase.from('subscription_plans').select('name, price_monthly').eq('id', planId).maybeSingle(),
  ]);
  if (!business?.owner_id || !plan?.name) return;

  const { data: owner } = await supabase
    .from('users')
    .select('push_token, email, full_name')
    .eq('id', business.owner_id)
    .maybeSingle();
  if (!owner) return;

  const planLabel = PLAN_LABEL[plan.name as string] ?? plan.name;

  if (owner.push_token) {
    await sendPush(
      owner.push_token,
      'Plan actualizado',
      `Tu negocio ahora tiene el plan ${planLabel}.`,
      { type: 'plan_changed', businessId }
    );
  }

  if (owner.email) {
    const priceRow =
      plan.price_monthly != null
        ? `<tr style="border-bottom:1px solid #eee"><td style="padding:10px 0;color:#666;font-size:13px">Monto</td><td style="padding:10px 0;text-align:right;font-weight:bold;color:#16a34a">$${Number(plan.price_monthly).toFixed(2)}</td></tr>`
        : '';
    await sendEmail(
      owner.email,
      'Pago confirmado — Suscripción activada',
      `<h2>¡Pago exitoso!</h2>
<p>Hola ${escapeHtml(owner.full_name)},</p>
<p>Tu pago fue procesado correctamente y tu suscripción ya está activa.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr style="border-bottom:1px solid #eee"><td style="padding:10px 0;color:#666;font-size:13px">Negocio</td><td style="padding:10px 0;text-align:right;font-weight:bold">${escapeHtml(business.name)}</td></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:10px 0;color:#666;font-size:13px">Plan</td><td style="padding:10px 0;text-align:right;font-weight:bold">${escapeHtml(planLabel)}</td></tr>
${priceRow}
<tr><td style="padding:10px 0;color:#666;font-size:13px">Vigente hasta</td><td style="padding:10px 0;text-align:right">${expiresAt.toLocaleDateString('es-EC')}</td></tr>
</table>
${appButton('pago-resultado', { tipo: 'subscription', ok: '1' })}`
    );
  }
}

async function activateSubscription(supabase: ReturnType<typeof createClient>, payment: PaymentRow) {
  if (!payment.plan_id) return;
  // Idempotencia: si fulfillPayment se reintenta (ver más abajo, ahora los
  // efectos se aplican ANTES de marcar el pago 'completed'), no crear una
  // segunda suscripción para el mismo pago.
  const { data: existing } = await supabase
    .from('business_subscriptions')
    .select('id')
    .eq('payment_id', payment.id)
    .maybeSingle();
  if (existing) return;

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

  await notifyPlanChanged(supabase, payment.business_id, payment.plan_id, expiresAt);
}

// La campaña recién se crea aquí, no antes -- el borrador vive en
// payments.metadata hasta que el pago se confirma. Queda en
// 'pending_review' para que el admin la apruebe antes de mostrarse a
// clientes (ver supabase/migrations/0025_ad_payments.sql).
async function createAdFromPayment(supabase: ReturnType<typeof createClient>, payment: PaymentRow) {
  const m = payment.metadata;
  if (!m) return;
  // Idempotencia: mismo motivo que activateSubscription -- no duplicar la
  // campaña si fulfillPayment se reintenta.
  const { data: existing } = await supabase.from('ads').select('id').eq('payment_id', payment.id).maybeSingle();
  if (existing) return;

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

  const { data: business } = await supabase
    .from('businesses')
    .select('owner_id, name')
    .eq('id', payment.business_id)
    .maybeSingle();
  const owner = business?.owner_id
    ? (await supabase.from('users').select('email, full_name').eq('id', business.owner_id).maybeSingle()).data
    : null;
  if (owner?.email) {
    await sendEmail(
      owner.email,
      'Pago confirmado — Campaña publicitaria',
      `<h2>¡Pago exitoso!</h2>
<p>Hola ${escapeHtml(owner.full_name)},</p>
<p>Tu campaña publicitaria fue pagada y quedó pendiente de revisión antes de mostrarse a los clientes.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr style="border-bottom:1px solid #eee"><td style="padding:10px 0;color:#666;font-size:13px">Negocio</td><td style="padding:10px 0;text-align:right;font-weight:bold">${escapeHtml(business?.name)}</td></tr>
<tr style="border-bottom:1px solid #eee"><td style="padding:10px 0;color:#666;font-size:13px">Campaña</td><td style="padding:10px 0;text-align:right;font-weight:bold">${escapeHtml(m.title as string)}</td></tr>
<tr><td style="padding:10px 0;color:#666;font-size:13px">Duración</td><td style="padding:10px 0;text-align:right">${escapeHtml(m.durationDays)} días</td></tr>
</table>
${appButton('pago-resultado', { tipo: 'advertising', ok: '1' })}`
    );
  }
}

async function fulfillPayment(
  supabase: ReturnType<typeof createClient>,
  payment: PaymentRow,
  gatewayTransactionId: string
) {
  // Los efectos se aplican ANTES de marcar el pago 'completed' -- si
  // createAdFromPayment/activateSubscription fallan a la mitad, el pago se
  // queda en su estado anterior (no 'completed') y un reintento real puede
  // repetir el flujo completo en vez de quedar "cobrado" sin plan/anuncio
  // activado y sin ninguna forma de reconciliar. Ambas funciones son
  // idempotentes (chequean si ya existe una fila para este payment.id) por
  // si el reintento llega después de que el efecto sí se aplicó.
  if (payment.type === 'advertising') {
    await createAdFromPayment(supabase, payment);
  } else {
    await activateSubscription(supabase, payment);
  }

  await supabase
    .from('payments')
    .update({ status: 'completed', gateway_transaction_id: gatewayTransactionId })
    .eq('id', payment.id);
}

Deno.serve(async (req) => {
  try {
    if (req.headers.get('x-internal-secret') !== PAYPHONE_CONFIRM_SECRET) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

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
      .select('id, business_id, plan_id, status, type, metadata, amount, client_transaction_id')
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
    if (payment.type === 'advertising' && !ADS_ENABLED) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      return new Response(
        JSON.stringify({ success: false, error: 'La publicidad no está disponible por el momento.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
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

      // FIX CRÍTICO: antes, si la confirmación real con Payphone fallaba,
      // se confiaba en `transactionStatus` mandado por quien LLAMA a esta
      // función (hintedStatus, del body del propio POST) para activar el
      // pago igual. Ese campo no tiene ninguna verificación de firma --
      // cualquiera con una cuenta autenticada podía pedir un plan, nunca
      // pagarlo, y llamar a payphone-return/esta función a mano con
      // transactionStatus: "Approved" para activarlo gratis. Nunca se debe
      // confiar en un status que no viene de la respuesta verificada de
      // Payphone -- si el confirm real falla, el pago falla, punto.
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

    // Defensa en profundidad: aunque el `id` numérico que se le pasa a
    // Payphone ya viene atado a un `clientTransactionId` en SU sistema (no
    // se puede fabricar un "Approved" para una transacción que no ocurrió),
    // nada obligaba a que el `id`/clientTransactionId que ESTA función
    // recibió correspondan de verdad al `payment` local que se está por
    // activar. Si alguien con el token filtrado (ver web/api/payphone-checkout.js)
    // llama a esta función con un `id` real y aprobado pero un
    // `clientTransactionId` de OTRO pago propio pendiente, la respuesta real
    // de Payphone trae su PROPIO clientTransactionId/amount (confirmados
    // contra docs.payphone.app/cajita-de-pagos-payphone) -- si no coinciden
    // con el pago local que se iba a activar, se corta acá.
    const returnedAmountCents = Math.round(Number(payment.amount) * 100);
    if (
      String(confirmData.clientTransactionId) !== payment.client_transaction_id ||
      Number(confirmData.amount) !== returnedAmountCents
    ) {
      console.error('payphone confirm mismatch', {
        expectedClientTransactionId: payment.client_transaction_id,
        expectedAmountCents: returnedAmountCents,
        confirmData,
      });
      return new Response(
        JSON.stringify({ success: false, error: 'La confirmación no corresponde a este pago' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
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
