import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/requireAdmin';
import { createAdminClient } from '../../../lib/supabase/admin';

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { price_per_day_city, price_per_day_national } = await req.json();
  const city = Number(price_per_day_city);
  const national = Number(price_per_day_national);
  if (!Number.isFinite(city) || city < 0 || !Number.isFinite(national) || national < 0) {
    return NextResponse.json({ error: 'Los precios deben ser números válidos mayores o iguales a 0.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('ad_pricing')
    .update({ price_per_day_city: city, price_per_day_national: national })
    .eq('id', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
