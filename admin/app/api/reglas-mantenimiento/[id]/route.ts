import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { interval_km, interval_months } = await req.json();
  const km = interval_km !== null && interval_km !== undefined ? Number(interval_km) : null;
  const months = interval_months !== null && interval_months !== undefined ? Number(interval_months) : null;
  if (km !== null && (!Number.isFinite(km) || km <= 0)) {
    return NextResponse.json({ error: 'El intervalo en km debe ser un número mayor a 0.' }, { status: 400 });
  }
  if (months !== null && (!Number.isFinite(months) || months <= 0)) {
    return NextResponse.json({ error: 'El intervalo en meses debe ser un número mayor a 0.' }, { status: 400 });
  }
  if (km === null && months === null) {
    return NextResponse.json({ error: 'Debes especificar al menos un intervalo (km o meses).' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('maintenance_rules')
    .update({ interval_km: km, interval_months: months })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('maintenance_rules').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
