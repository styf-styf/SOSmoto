import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

// Reemplaza el prefijo "Promoción de lanzamiento:" que ve el negocio en la
// tarjeta de planes (app/(business)/suscripcion.tsx) -- el resto del texto
// se mantiene fijo, solo cambia la etiqueta. Enviar text vacío/null vuelve
// al texto por defecto.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { planId, text } = await req.json().catch(() => ({}));
  if (!planId) {
    return NextResponse.json({ error: 'Falta planId' }, { status: 400 });
  }
  const labelText = typeof text === 'string' && text.trim().length > 0 ? text.trim() : null;

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('plan_promotions')
    .select('id')
    .eq('plan_id', planId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Primero define los días de garantía por negocio.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('plan_promotions')
    .update({ label_text: labelText, updated_at: new Date().toISOString() })
    .eq('id', existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
