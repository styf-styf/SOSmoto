import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/requireAdmin';
import { createAdminClient } from '../../../lib/supabase/admin';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { moto_type, service_name, interval_km, interval_months } = await req.json();
  if (!moto_type || !service_name) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('maintenance_rules').insert({
    moto_type,
    service_name,
    interval_km: interval_km !== null && interval_km !== undefined ? Number(interval_km) : null,
    interval_months: interval_months !== null && interval_months !== undefined ? Number(interval_months) : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
