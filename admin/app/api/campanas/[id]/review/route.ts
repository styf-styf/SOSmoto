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

  // Solo se puede aprobar/rechazar una campaña que sigue 'pending_review' --
  // sin esto se podía "aprobar" un anuncio ya vencido/rechazado y revivirlo
  // sin nuevo pago ni revalidar starts_at/ends_at (que quedan en el pasado).
  const { data: current, error: currentError } = await supabase
    .from('ads')
    .select('status')
    .eq('id', params.id)
    .maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Anuncio no encontrado' }, { status: 404 });
  if (current.status !== 'pending_review') {
    return NextResponse.json({ error: 'Esta campaña ya no está pendiente de revisión.' }, { status: 400 });
  }

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
