import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/requireAdmin';
import { createAdminClient } from '../../../lib/supabase/admin';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { name, kind } = await req.json();
  if (!name || !kind) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('categories').insert({
    name: String(name).trim(),
    kind,
    status: 'approved',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
