import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Cada plan tiene una única fila para siempre (plan_promotions_plan_id_key).
// Activar es "reanudar" si ya existía una campaña con días restantes, o
// "arrancar de cero" si nunca se usó o ya se agotó. Nunca afecta a los
// negocios que ya reclamaron el beneficio (su expires_at ya quedó fijo).
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { planId, durationDays } = await req.json().catch(() => ({}));
  if (!planId) {
    return NextResponse.json({ error: 'Falta planId' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  // Pausar cualquier otra promoción activa (solo puede haber una a la vez).
  const { data: otherActive } = await supabase
    .from('plan_promotions')
    .select('id, remaining_days, activated_at')
    .eq('is_active', true)
    .neq('plan_id', planId)
    .maybeSingle();
  if (otherActive) {
    const elapsedDays = (now.getTime() - new Date(otherActive.activated_at).getTime()) / MS_PER_DAY;
    const remaining = Math.max(0, Number(otherActive.remaining_days) - elapsedDays);
    const { error: pauseError } = await supabase
      .from('plan_promotions')
      .update({ is_active: false, remaining_days: remaining, updated_at: now.toISOString() })
      .eq('id', otherActive.id);
    if (pauseError) return NextResponse.json({ error: pauseError.message }, { status: 500 });
  }

  const { data: existing } = await supabase
    .from('plan_promotions')
    .select('id, remaining_days')
    .eq('plan_id', planId)
    .maybeSingle();

  if (existing && Number(existing.remaining_days) > 0) {
    // Reanudar: se mantienen los días restantes, no se reinician.
    const { error } = await supabase
      .from('plan_promotions')
      .update({ is_active: true, activated_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (!durationDays || Number(durationDays) <= 0) {
    return NextResponse.json({ error: 'Falta durationDays para arrancar una campaña nueva' }, { status: 400 });
  }

  if (existing) {
    const { error } = await supabase
      .from('plan_promotions')
      .update({
        duration_days: Number(durationDays),
        remaining_days: Number(durationDays),
        is_active: true,
        activated_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from('plan_promotions').insert({
      plan_id: planId,
      duration_days: Number(durationDays),
      remaining_days: Number(durationDays),
      is_active: true,
      activated_at: now.toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
