import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/requireAdmin';
import { createAdminClient } from '../../../lib/supabase/admin';

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { price_per_day_city, price_per_day_national, radius_reference_km, radius_cap_km } = await req.json();
  const city = Number(price_per_day_city);
  const national = Number(price_per_day_national);
  const referenceKm = Number(radius_reference_km);
  const capKm = Number(radius_cap_km);
  if (
    !Number.isFinite(city) ||
    city < 0 ||
    !Number.isFinite(national) ||
    national < 0 ||
    !Number.isFinite(referenceKm) ||
    referenceKm <= 0 ||
    !Number.isFinite(capKm) ||
    capKm <= 0
  ) {
    return NextResponse.json({ error: 'Todos los valores deben ser números válidos mayores a 0 (ciudad/nacional pueden ser 0).' }, { status: 400 });
  }
  // El precio de Ciudad nunca puede superar al de País, y viceversa el de
  // País nunca puede quedar por debajo del de Ciudad -- es la misma
  // comparación, pero ambas direcciones importan: si se rompe, el radio (que
  // interpola entre los dos) quedaría con una tarifa que baja al subir los
  // km, algo que no tiene sentido para el negocio que paga.
  if (city > national) {
    return NextResponse.json(
      { error: 'El precio de Ciudad no puede ser mayor al de País (ni el de País menor al de Ciudad).' },
      { status: 400 }
    );
  }
  if (referenceKm >= capKm) {
    return NextResponse.json({ error: 'El "radio de referencia" debe ser menor al "radio tope".' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('ad_pricing')
    .update({
      price_per_day_city: city,
      price_per_day_national: national,
      radius_reference_km: Math.round(referenceKm),
      radius_cap_km: Math.round(capKm),
    })
    .eq('id', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
