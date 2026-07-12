import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

// Desactivar NO afecta a los negocios que ya reclamaron el beneficio -- sus
// filas en business_subscriptions ya tienen su propio expires_at, y ese
// vencimiento se sigue respetando igual que cualquier suscripción paga (lo
// procesa el mismo cron check-subscription-expiry).
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('plan_promotions')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('is_active', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
