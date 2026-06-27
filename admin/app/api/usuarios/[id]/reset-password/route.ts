import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../../lib/supabase/admin';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { data: targetRow } = await supabase.from('users').select('email').eq('id', params.id).maybeSingle();
  if (!targetRow) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const { error } = await supabase.auth.resetPasswordForEmail(targetRow.email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
