import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../../lib/supabase/admin';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { data: targetRow } = await supabase.from('users').select('role').eq('id', params.id).maybeSingle();
  if (!targetRow) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  if (targetRow.role === 'admin') {
    return NextResponse.json({ error: 'No se puede suspender una cuenta admin' }, { status: 400 });
  }

  const { error: banError } = await supabase.auth.admin.updateUserById(params.id, { ban_duration: '876000h' });
  if (banError) return NextResponse.json({ error: banError.message }, { status: 500 });

  const { error: updateError } = await supabase.from('users').update({ is_suspended: true }).eq('id', params.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
