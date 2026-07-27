import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import { sendPushToUser } from '../../../../../lib/push';
import { sendEmailViaResend } from '../../../../../lib/resend';

const APP_URL = 'https://sosmoto.net/api/abrir?to=negocio&seccion=verificacion';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { decision, adminNotes } = await req.json();
  if (!['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'Decisión inválida' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: request, error: fetchError } = await supabase
    .from('business_verification_requests')
    .select('business_id')
    .eq('id', params.id)
    .single();
  if (fetchError || !request) {
    return NextResponse.json({ error: fetchError?.message ?? 'Solicitud no encontrada' }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from('business_verification_requests')
    .update({
      status: decision,
      admin_notes: adminNotes?.trim() || null,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { data: business } = await supabase
    .from('businesses')
    .select('owner_id, name')
    .eq('id', request.business_id)
    .maybeSingle();

  if (decision === 'approved') {
    const { error: businessError } = await supabase
      .from('businesses')
      .update({ is_verified: true })
      .eq('id', request.business_id);
    if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });
  }

  if (business?.owner_id) {
    const title = decision === 'approved' ? '¡Negocio verificado!' : 'Verificación rechazada';
    const body =
      decision === 'approved'
        ? `${business.name} obtuvo la insignia de verificado en SOSmoto.`
        : `Tu solicitud de verificación fue rechazada.${adminNotes ? ` Motivo: ${adminNotes}` : ''}`;
    sendPushToUser(business.owner_id, title, body, { type: 'kyc_review', decision }).catch(() => {});

    const { data: owner } = await supabase.from('users').select('email').eq('id', business.owner_id).maybeSingle();
    if (owner?.email) {
      sendEmailViaResend({
        from: 'no-reply',
        to: owner.email,
        subject: title,
        html:
          decision === 'approved'
            ? `<h2>¡Negocio verificado!</h2><p>${business.name} obtuvo la insignia de "verificado" en SOSmoto.</p><a href="${APP_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#FF6B00;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Ver en SOSmoto</a>`
            : `<h2>Verificación rechazada</h2><p>Tu solicitud de verificación fue rechazada.</p>${adminNotes ? `<p><strong>Motivo:</strong> ${adminNotes}</p>` : ''}<p>Podés corregir y volver a enviar tus documentos desde la app.</p><a href="${APP_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#FF6B00;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Ver en SOSmoto</a>`,
      }).catch((err) => console.error('email de revisión de KYC falló', err));
    }
  }

  return NextResponse.json({ success: true });
}
