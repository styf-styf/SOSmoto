import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

// Un plan no puede activar su promoción si ya existe otra activa -- el
// admin debe desactivar la otra primero (no se auto-pausa). Los días de la
// campaña se fijan por separado (ver /api/promociones/dias) antes de
// activar; acá solo se prende el toggle usando lo que ya quedó guardado en
// remaining_days.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { planId } = await req.json().catch(() => ({}));
  if (!planId) {
    return NextResponse.json({ error: 'Falta planId' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: otherActive } = await supabase
    .from('plan_promotions')
    .select('id')
    .eq('is_active', true)
    .neq('plan_id', planId)
    .maybeSingle();
  if (otherActive) {
    return NextResponse.json(
      { error: 'Ya hay otra promoción activa. Desactívala primero para poder activar esta.' },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from('plan_promotions')
    .select('id, remaining_days')
    .eq('plan_id', planId)
    .maybeSingle();
  if (!existing || Number(existing.remaining_days) <= 0) {
    return NextResponse.json({ error: 'Primero define cuántos días va a durar la promoción.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('plan_promotions')
    .update({ is_active: true, activated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
