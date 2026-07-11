import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('products').delete().eq('id', params.id);
  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'No se puede eliminar: este producto tiene reseñas o compras asociadas. Desactívalo desde el catálogo del negocio en vez de eliminarlo.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
