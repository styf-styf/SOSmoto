import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../../lib/supabase/admin';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { decision } = await req.json();
  if (!['active', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'Decisión inválida' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('ads').update({ status: decision }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
