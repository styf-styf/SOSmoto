import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, number | null | boolean> = {};
  for (const key of ['price_monthly', 'max_products', 'max_services', 'max_photos_per_item', 'max_employees', 'max_active_stories']) {
    if (!(key in body)) continue;
    if (body[key] === null) {
      updates[key] = null;
      continue;
    }
    const value = Number(body[key]);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: `${key} debe ser un número válido mayor o igual a 0.` }, { status: 400 });
    }
    updates[key] = value;
  }
  if ('max_photos_per_item' in updates) {
    const maxPhotos = updates.max_photos_per_item;
    if (maxPhotos === null || (typeof maxPhotos === 'number' && maxPhotos < 1)) {
      return NextResponse.json({ error: 'Máx. fotos debe ser al menos 1.' }, { status: 400 });
    }
  }
  if ('has_featured_listing' in body) {
    updates.has_featured_listing = Boolean(body.has_featured_listing);
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('subscription_plans').update(updates).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
