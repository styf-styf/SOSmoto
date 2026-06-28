import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../../lib/supabase/admin';

// "Limitar" no oculta al negocio de la búsqueda ni afecta sus anuncios
// activos -- solo bloquea crear anuncios nuevos, subir historias, crear
// publicaciones, editar catálogo, gestionar empleados y usar el chat. Sigue
// recibiendo y aceptando solicitudes de auxilio, y la agenda de citas no se
// toca.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { reason } = await req.json().catch(() => ({ reason: undefined }));
  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: 'Debes indicar un motivo de la limitación' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('businesses')
    .update({ is_limited: true, limitation_reason: reason.trim() })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
