import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { sendPushToUser } from '../../../../../lib/push';
import { createAdminClient } from '../../../../../lib/supabase/admin';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('users').update({ is_limited: false }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sendPushToUser(params.id, 'Cuenta restablecida', 'Se quitó el límite de tu cuenta. Ya puedes usar la app con normalidad.', {
    type: 'account_restored',
  });

  return NextResponse.json({ success: true });
}
