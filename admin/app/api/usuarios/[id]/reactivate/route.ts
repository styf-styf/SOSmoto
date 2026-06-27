import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../../lib/supabase/admin';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();

  const { error: banError } = await supabase.auth.admin.updateUserById(params.id, { ban_duration: 'none' });
  if (banError) return NextResponse.json({ error: banError.message }, { status: 500 });

  const { error: updateError } = await supabase.from('users').update({ is_suspended: false }).eq('id', params.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
