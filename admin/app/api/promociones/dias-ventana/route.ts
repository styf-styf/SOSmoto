import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

// Días de la VENTANA de la promoción (distinto de /dias, que es la garantía
// que recibe cada negocio) -- si se configuran, la promoción se autoapaga
// sola al cumplirse (ver cron expire-plan-promotion-windows, 0180). Enviar
// days=null/0 quita el autoapagado y vuelve a manual-only.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { planId, days } = await req.json().catch(() => ({}));
  if (!planId) {
    return NextResponse.json({ error: 'Falta planId' }, { status: 400 });
  }
  const windowDays = days === null || days === undefined || Number(days) <= 0 ? null : Number(days);

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('plan_promotions')
    .select('id, is_active')
    .eq('plan_id', planId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Primero define los días de garantía por negocio.' }, { status: 400 });
  }
  if (existing.is_active) {
    return NextResponse.json({ error: 'Pausa la promoción antes de cambiar los días de la ventana.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('plan_promotions')
    .update({ window_days: windowDays, remaining_window_days: windowDays, updated_at: new Date().toISOString() })
    .eq('id', existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
