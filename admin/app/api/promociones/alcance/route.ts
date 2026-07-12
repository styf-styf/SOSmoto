import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

// Interruptor global: si appliesToAll es true, la promoción activa la puede
// reclamar cualquier negocio ya registrado, no solo los que se registraron
// después de activarse. promotion_settings es una tabla de una sola fila
// (id boolean primary key = true).
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { appliesToAll } = await req.json().catch(() => ({}));
  if (typeof appliesToAll !== 'boolean') {
    return NextResponse.json({ error: 'Falta appliesToAll (boolean)' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('promotion_settings')
    .update({ applies_to_all_businesses: appliesToAll, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
