import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { sendPushToUser } from '../../../../lib/push';

const PLAN_LABELS: Record<string, string> = { free: 'Free', standard: 'Estándar', pro: 'Pro' };

// Asigna un plan y una fecha de corte a un negocio a mano, sin pasar por
// Payphone ni por las restricciones del auto-reclamo (elegibilidad por
// fecha de registro, una sola vez por negocio). Es la vía de escape para el
// caso "un promotor ya le prometió el plan en persona" o "el negocio ya
// reclamó una promoción antes pero igual queremos dársela". Si el negocio
// no había reclamado nada todavía, esto también consume su "cupo" de
// promoción -- así no puede además auto-reclamarla luego desde la app.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { businessId, planId, expiresAt } = await req.json().catch(() => ({}));
  if (!businessId || !planId) {
    return NextResponse.json({ error: 'Faltan datos (businessId, planId)' }, { status: 400 });
  }
  // expiresAt puede venir null a propósito (checkbox "Sin fecha de corte") --
  // check-subscription-expiry ya excluye expires_at null de su revisión, así
  // que una fila con null nunca vence ni se baja de plan sola.
  let expiresIso: string | null = null;
  if (expiresAt) {
    const expires = new Date(expiresAt);
    if (Number.isNaN(expires.getTime())) {
      return NextResponse.json({ error: 'Fecha de corte inválida' }, { status: 400 });
    }
    expiresIso = expires.toISOString();
  }

  const supabase = createAdminClient();
  const { data: business } = await supabase
    .from('businesses')
    .select('id, owner_id, promotion_claimed_at')
    .eq('id', businessId)
    .maybeSingle();
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

  const { data: plan } = await supabase.from('subscription_plans').select('id, name').eq('id', planId).maybeSingle();
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });

  const { data: promo } = await supabase.from('plan_promotions').select('id').eq('plan_id', planId).maybeSingle();
  const now = new Date();

  const { error: expireError } = await supabase
    .from('business_subscriptions')
    .update({ status: 'expired' })
    .eq('business_id', businessId)
    .eq('status', 'active');
  if (expireError) return NextResponse.json({ error: expireError.message }, { status: 500 });

  const { error: insertError } = await supabase.from('business_subscriptions').insert({
    business_id: businessId,
    plan_id: planId,
    status: 'active',
    started_at: now.toISOString(),
    expires_at: expiresIso,
    payment_id: null,
    promotion_id: promo?.id ?? null,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const businessUpdate: Record<string, unknown> = { plan_id: planId };
  if (!business.promotion_claimed_at) businessUpdate.promotion_claimed_at = now.toISOString();
  const { error: updateError } = await supabase.from('businesses').update(businessUpdate).eq('id', businessId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (business.owner_id) {
    await sendPushToUser(
      business.owner_id,
      'Plan actualizado',
      `El equipo de SOSmoto te asignó el plan ${PLAN_LABELS[plan.name] ?? plan.name}.`,
      { type: 'plan_changed', businessId }
    );
  }

  return NextResponse.json({ success: true });
}
