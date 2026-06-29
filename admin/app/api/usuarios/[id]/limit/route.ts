import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAdmin';
import { sendPushToUser } from '../../../../../lib/push';
import { createAdminClient } from '../../../../../lib/supabase/admin';

// "Limitar" no bloquea el login ni oculta nada -- solo impide crear
// publicaciones, subir historias, y bloquea la búsqueda de talleres en la
// app (ver app/(client)/(tabs)/buscar.tsx). El auxilio (pedir/usar SOS)
// nunca se restringe.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { reason } = await req.json().catch(() => ({ reason: undefined }));
  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: 'Debes indicar un motivo de la limitación' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: targetRow } = await supabase.from('users').select('role').eq('id', params.id).maybeSingle();
  if (!targetRow) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  if (targetRow.role === 'admin') {
    return NextResponse.json({ error: 'No se puede limitar una cuenta admin' }, { status: 400 });
  }

  const { error } = await supabase
    .from('users')
    .update({ is_limited: true, limitation_reason: reason.trim() })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sendPushToUser(params.id, 'Cuenta limitada', `Tu cuenta está limitada: ${reason.trim()}`, {
    type: 'account_limited',
  });

  return NextResponse.json({ success: true });
}
