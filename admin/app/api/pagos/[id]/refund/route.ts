import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../../lib/supabase/admin';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('status')
    .eq('id', params.id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!payment) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
  if (payment.status !== 'completed') {
    return NextResponse.json({ error: 'Solo se pueden reembolsar pagos completados.' }, { status: 400 });
  }

  const { error } = await supabase.from('payments').update({ status: 'refunded' }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
