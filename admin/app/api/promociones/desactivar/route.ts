import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Pausar: descuenta los días transcurridos desde activated_at de
// remaining_days y guarda ese saldo -- al reactivar (ver /activar) se
// retoma desde ahí, no se reinicia. No afecta a los negocios que ya
// reclamaron el beneficio -- su expires_at ya quedó fijo.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { data: active } = await supabase
    .from('plan_promotions')
    .select('id, remaining_days, activated_at')
    .eq('is_active', true)
    .maybeSingle();
  if (!active) return NextResponse.json({ success: true });

  const now = new Date();
  const elapsedDays = (now.getTime() - new Date(active.activated_at).getTime()) / MS_PER_DAY;
  const remaining = Math.max(0, Number(active.remaining_days) - elapsedDays);

  const { error } = await supabase
    .from('plan_promotions')
    .update({ is_active: false, remaining_days: remaining, updated_at: now.toISOString() })
    .eq('id', active.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
