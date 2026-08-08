import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { appButton, escapeHtml, sendEmail } from './resend.ts';

// Compartido entre payphone-confirm (confirmación normal, dentro de los 5
// min que da Payphone) y expire-stale-payments (segunda oportunidad para un
// pago que quedó `pending` por más de 2h) -- ambos necesitan activar
// exactamente el mismo efecto cuando Payphone dice "Approved", así que la
// lógica vive en un solo lugar en vez de mantenerse duplicada en dos
// funciones que podrían desincronizarse con el tiempo.

// Publicidad está desactivada para el lanzamiento (ver constants/features.ts
// en la app -- duplicado acá igual que en ad-prepare/ad-resubmit/
// check-business-growth).
export const ADS_ENABLED = false;

export type PaymentRow = {
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

const TYPE_LABEL: Record<string, string> = { subscription: 'tu suscripción', advertising: 'tu campaña publicitaria' };

// A diferencia de notifyPlanChanged (pago aprobado), esto no tenía ningún
// aviso -- un pago 'failed' quedaba silencioso: el negocio solo se enteraba
// si entraba manualmente a revisar su historial de pagos. Se llama desde
// las 3 rutas que marcan 'failed' en payphone-confirm.
export async function notifyPaymentFailed(supabase: ReturnType<typeof createClient>, payment: PaymentRow) {
  const { data: business } = await supabase
    .from('businesses')
    .select('owner_id, name')
    .eq('id', payment.business_id)
    .maybeSingle();
  if (!business?.owner_id) return;

  const { data: owner } = await supabase
    .from('users')
    .select('push_token, email, full_name')
    .eq('id', business.owner_id)
    .maybeSingle();
  if (!owner) return;

  const typeLabel = TYPE_LABEL[payment.type] ?? 'tu pago';

  if (owner.push_token) {
    await sendPush(
      owner.push_token,
      'Pago no confirmado',
      `No pudimos confirmar el pago de ${typeLabel}. Si el cobro fue rechazado, no se aplicó ningún cambio.`,
      { type: 'payment_failed', businessId: payment.business_id }
    );
  }

  if (owner.email) {
    await sendEmail(
      owner.email,
      'No pudimos confirmar tu pago',
      `<h2>No pudimos confirmar tu pago</h2>
<p>Hola ${escapeHtml(owner.full_name)},</p>
<p>No pudimos confirmar el pago de ${typeLabel}. Si el cobro fue rechazado por tu banco o tarjeta, no se aplicó ningún cambio -- puedes intentarlo de nuevo cuando quieras desde la app.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr style="border-bottom:1px solid #eee"><td style="padding:10px 0;color:#666;font-size:13px">Negocio</td><td style="padding:10px 0;text-align:right;font-weight:bold">${escapeHtml(business.name)}</td></tr>
<tr><td style="padding:10px 0;color:#666;font-size:13px">Monto</td><td style="padding:10px 0;text-align:right">$${Number(payment.amount).toFixed(2)}</td></tr>
</table>
${appButton('pago-resultado', { tipo: payment.type, ok: '0' })}`
    );
  }
}

async function activateSubscription(supabase: ReturnType<typeof createClient>, payment: PaymentRow) {
  if (!payment.plan_id) return;
  // Idempotencia: si fulfillPayment se reintenta, no crear una segunda
  // suscripción para el mismo pago.
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

export async function fulfillPayment(
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
