import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

// Deja al admin fijar (o corregir) cuántos días dura la promoción de un
// plan -- tanto antes de activarla por primera vez como mientras está
// pausada (con días restantes de una campaña anterior). No se puede tocar
// mientras está activa: hay que pausarla primero.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { planId, days } = await req.json().catch(() => ({}));
  if (!planId || !days || Number(days) <= 0) {
    return NextResponse.json({ error: 'Faltan datos (planId, days)' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('plan_promotions')
    .select('id, is_active')
    .eq('plan_id', planId)
    .maybeSingle();

  if (existing?.is_active) {
    return NextResponse.json({ error: 'Pausa la promoción antes de cambiar los días.' }, { status: 400 });
  }

  if (existing) {
    const { error } = await supabase
      .from('plan_promotions')
      .update({ duration_days: Number(days), remaining_days: Number(days), updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from('plan_promotions').insert({
      plan_id: planId,
      duration_days: Number(days),
      remaining_days: Number(days),
      is_active: false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
