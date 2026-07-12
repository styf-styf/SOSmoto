import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../../lib/supabase/admin';

// Permite al admin ajustar la fecha de corte de un beneficio de promoción ya
// otorgado (ej. un promotor negoció 6 meses en persona aunque la promo
// default era de 3). Solo toca filas que vinieron de una promoción
// (promotion_id not null) -- nunca una suscripción paga normal.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { expiresAt } = await req.json().catch(() => ({}));
  if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
    return NextResponse.json({ error: 'Falta una fecha de corte válida (expiresAt)' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('business_subscriptions')
    .select('id, promotion_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Beneficio no encontrado' }, { status: 404 });
  if (!existing.promotion_id) {
    return NextResponse.json({ error: 'Esta suscripción no vino de una promoción' }, { status: 400 });
  }

  const { error } = await supabase
    .from('business_subscriptions')
    .update({ expires_at: new Date(expiresAt).toISOString() })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
