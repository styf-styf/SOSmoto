import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { sendPushToUser } from '../../../../../lib/push';
import { createAdminClient } from '../../../../../lib/supabase/admin';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { data: business, error } = await supabase
    .from('businesses')
    .update({ is_limited: false })
    .eq('id', params.id)
    .select('owner_id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (business?.owner_id) {
    await sendPushToUser(
      business.owner_id,
      'Negocio restablecido',
      'Se quitó el límite de tu negocio. Ya puedes usar la app con normalidad.',
      { type: 'business_restored' }
    );
  }

  return NextResponse.json({ success: true });
}
