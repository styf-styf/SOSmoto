import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../../lib/supabase/admin';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('id, status, type, business_id, plan_id')
    .eq('id', params.id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!payment) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
  if (payment.status !== 'completed') {
    return NextResponse.json({ error: 'Solo se pueden reembolsar pagos completados.' }, { status: 400 });
  }

  const { error } = await supabase.from('payments').update({ status: 'refunded' }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // El pago no revertía nada más -- el negocio se quedaba disfrutando el
  // plan pago (o el anuncio seguía activo) pese a que la plataforma ya le
  // devolvió el dinero. Ver check-subscription-expiry, que sí hace esto
  // mismo cuando una suscripción vence naturalmente.
  if (payment.type === 'subscription') {
    await supabase
      .from('business_subscriptions')
      .update({ status: 'cancelled' })
      .eq('payment_id', payment.id)
      .eq('status', 'active');

    const { data: business } = await supabase
      .from('businesses')
      .select('business_type')
      .eq('id', payment.business_id)
      .maybeSingle();
    if (business?.business_type) {
      const { data: freePlan } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('name', 'free')
        .eq('business_type', business.business_type)
        .maybeSingle();
      if (freePlan) {
        await supabase.from('businesses').update({ plan_id: freePlan.id }).eq('id', payment.business_id);
      }
    }
  } else if (payment.type === 'advertising') {
    await supabase
      .from('ads')
      .update({ status: 'expired' })
      .eq('payment_id', payment.id)
      .in('status', ['pending_review', 'approved', 'active']);
  }

  return NextResponse.json({ success: true });
}
