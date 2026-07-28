import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/requireAdmin';
import { createAdminClient } from '../../../lib/supabase/admin';

const TYPE_LABEL: Record<string, string> = { terms: 'los Términos y Condiciones', privacy: 'la Política de Privacidad' };
const CHUNK_SIZE = 100; // límite de Expo por request de push batch

async function sendPushBatch(messages: { to: string; title: string; body: string; data: Record<string, unknown> }[]) {
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    }).catch((err) => console.error('push batch error', err));
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { type, content } = await req.json();
  if (!['terms', 'privacy'].includes(type) || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: latest } = await supabase
    .from('legal_documents')
    .select('version')
    .eq('type', type)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latest?.version ?? 0) + 1;

  const { error: insertError } = await supabase
    .from('legal_documents')
    .insert({ type, version: nextVersion, content: content.trim(), published_by: admin.id });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Notifica a TODOS los usuarios (push + fila en su campanita) -- no
  // bloqueante para el usuario (puede seguir usando la app), el aviso deja
  // explícito que seguir usándola sin objetar se toma como aceptación.
  const { data: users } = await supabase.from('users').select('id, push_token');
  const title = 'Actualizamos nuestros términos';
  const body = `Actualizamos ${TYPE_LABEL[type]}. Revísalos en la app -- si continúas usándola, se considera que los aceptas.`;

  if (users && users.length > 0) {
    const notifRows = users.map((u) => ({ user_id: u.id, title, body, data: { type: 'legal_update' } }));
    await supabase.from('notifications').insert(notifRows);

    const pushMessages = users
      .filter((u): u is { id: string; push_token: string } => !!u.push_token)
      .map((u) => ({ to: u.push_token, title, body, data: { type: 'legal_update' } }));
    if (pushMessages.length > 0) await sendPushBatch(pushMessages);
  }

  return NextResponse.json({ success: true, version: nextVersion });
}
