import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/requireAdmin';
import { createAdminClient } from '../../../lib/supabase/admin';

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { default_aid_radius_km } = await req.json();
  const radius = Number(default_aid_radius_km);
  if (!Number.isFinite(radius) || radius < 1) {
    return NextResponse.json({ error: 'El radio debe ser un número válido mayor o igual a 1.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('system_settings')
    .update({ default_aid_radius_km: radius })
    .eq('id', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
