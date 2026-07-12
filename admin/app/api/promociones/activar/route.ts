import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

// Activa una promoción para un plan (Estándar o Pro). Nunca reescribe una
// fila existente: crea una nueva -- así los negocios que ya reclamaron una
// promoción anterior mantienen intacta la referencia a sus condiciones
// originales (duration_days/activated_at), aunque el admin cambie o
// desactive la oferta después. Solo puede haber una fila activa a la vez
// (índice único parcial en la migración), así que primero se desactiva
// cualquier otra.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { planId, durationDays } = await req.json().catch(() => ({}));
  if (!planId || !durationDays || Number(durationDays) <= 0) {
    return NextResponse.json({ error: 'Faltan datos (planId, durationDays)' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error: deactivateError } = await supabase
    .from('plan_promotions')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('is_active', true);
  if (deactivateError) return NextResponse.json({ error: deactivateError.message }, { status: 500 });

  const { error: insertError } = await supabase.from('plan_promotions').insert({
    plan_id: planId,
    duration_days: Number(durationDays),
    is_active: true,
    activated_at: new Date().toISOString(),
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
