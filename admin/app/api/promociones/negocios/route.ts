import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

// Busca negocios por nombre para el buscador de "asignar plan manualmente".
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ businesses: [] });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, city')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ businesses: data ?? [] });
}
