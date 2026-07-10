import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, string> = {};
  if ('admin_notes' in body) updates.admin_notes = body.admin_notes ?? '';
  if ('dispute_status' in body) updates.dispute_status = body.dispute_status;

  const supabase = createAdminClient();
  const { error } = await supabase.from('help_requests').update(updates).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
