import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { sendPushToUser } from '../../../../../lib/push';
import { createAdminClient } from '../../../../../lib/supabase/admin';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { decision, reason } = await req.json();
  if (!['active', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'Decisión inválida' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: ad, error } = await supabase
    .from('ads')
    .update({
      status: decision,
      rejection_reason: decision === 'rejected' ? (typeof reason === 'string' ? reason.trim() || null : null) : null,
    })
    .eq('id', params.id)
    .select('business_id, title')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: business } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', ad.business_id)
    .maybeSingle();
  if (business?.owner_id) {
    await sendPushToUser(
      business.owner_id,
      decision === 'active' ? 'Anuncio aprobado' : 'Anuncio rechazado',
      decision === 'active'
        ? `Tu campaña "${ad.title}" ya está activa.`
        : `Tu campaña "${ad.title}" fue rechazada. Revisa el motivo en la app y corrígelo antes de reenviar.`,
      { type: decision === 'active' ? 'ad_approved' : 'ad_rejected', adId: params.id }
    );
  }

  return NextResponse.json({ success: true });
}
