import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../../lib/supabase/admin';

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

  if (decision === 'approved') {
    const { error: businessError } = await supabase
      .from('businesses')
      .update({ is_verified: true })
      .eq('id', request.business_id);
    if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
