import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

// Taller y Tienda son INDEPENDIENTES entre si -- un plan no puede activar su
// promoción si ya existe otra activa del MISMO business_type (Estándar
// mientras Pro del mismo tipo está activo, o viceversa) -- el admin debe
// desactivar esa primero (no se auto-pausa). En cambio, taller y tienda sí
// pueden tener niveles distintos activos a la vez (ej. taller Estándar +
// tienda Pro) -- mismo criterio que el trigger de backend
// enforce_single_active_promotion_tier (0179). Los días de la campaña se
// fijan por separado (ver /api/promociones/dias) antes de activar; acá solo
// se prende el toggle usando lo que ya quedó guardado en remaining_days.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { planId } = await req.json().catch(() => ({}));
  if (!planId) {
    return NextResponse.json({ error: 'Falta planId' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: newPlan } = await supabase
    .from('subscription_plans')
    .select('name, business_type')
    .eq('id', planId)
    .maybeSingle();
  if (!newPlan) {
    return NextResponse.json({ error: 'Plan no encontrado' }, { status: 400 });
  }

  const { data: otherActiveRows } = await supabase
    .from('plan_promotions')
    .select('id, subscription_plans(business_type)')
    .eq('is_active', true)
    .neq('plan_id', planId);
  const conflicting = (otherActiveRows ?? []).some(
    (row) => (row.subscription_plans as unknown as { business_type: string } | null)?.business_type === newPlan.business_type
  );
  if (conflicting) {
    return NextResponse.json(
      { error: 'Ya hay una promoción activa de otro nivel para este mismo tipo de negocio. Desactívala primero para poder activar esta.' },
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
