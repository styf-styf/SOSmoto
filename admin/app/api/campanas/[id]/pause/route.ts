import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../../lib/supabase/admin';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();

  // Solo tiene sentido pausar una campaña ACTIVA -- sin esto se podía
  // "pausar" (→ expired) un anuncio todavía pending_review o ya rejected,
  // mezclando estados que no deberían mezclarse.
  const { data: current, error: currentError } = await supabase
    .from('ads')
    .select('status')
    .eq('id', params.id)
    .maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Anuncio no encontrado' }, { status: 404 });
  if (current.status !== 'active') {
    return NextResponse.json({ error: 'Solo se pueden pausar campañas activas.' }, { status: 400 });
  }

  const { error } = await supabase.from('ads').update({ status: 'expired' }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
