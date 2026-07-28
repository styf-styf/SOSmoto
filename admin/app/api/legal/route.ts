import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/requireAdmin';
import { sendBatchEmailsViaResend } from '../../../lib/resend';
import { createAdminClient } from '../../../lib/supabase/admin';

const TYPE_LABEL: Record<string, string> = { terms: 'los Términos y Condiciones', privacy: 'la Política de Privacidad' };
const TYPE_URL: Record<string, string> = { terms: 'https://sosmoto.net/terminos', privacy: 'https://sosmoto.net/privacidad' };
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

  // Notifica a TODOS los usuarios (push + campanita + correo) -- no
  // bloqueante para el usuario (puede seguir usando la app), el aviso deja
  // explícito que seguir usándola sin objetar se toma como aceptación. El
  // correo es el canal que de verdad deja constancia de que se avisó (llega
  // aunque el usuario no abra la app), push/campanita son el complemento
  // para quien sí está activo.
  const { data: users } = await supabase.from('users').select('id, email, push_token');
  const title = 'Actualizamos nuestros términos';
  const body = `Actualizamos ${TYPE_LABEL[type]}. Revísalos en la app -- si continúas usándola, se considera que los aceptas.`;

  if (users && users.length > 0) {
    const notifRows = users.map((u) => ({ user_id: u.id, title, body, data: { type: 'legal_update' } }));
    await supabase.from('notifications').insert(notifRows);

    const pushMessages = users
      .filter((u): u is { id: string; email: string; push_token: string } => !!u.push_token)
      .map((u) => ({ to: u.push_token, title, body, data: { type: 'legal_update' } }));
    if (pushMessages.length > 0) await sendPushBatch(pushMessages);

    const docUrl = TYPE_URL[type];
    const emailHtml = `<h2>Actualizamos ${TYPE_LABEL[type]}</h2><p>Te avisamos que actualizamos ${TYPE_LABEL[type]} de SOSmoto.</p><p><a href="${docUrl}" style="display:inline-block;margin-top:8px;padding:12px 24px;background:#FF6B00;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Revisar cambios</a></p><p style="font-size:12px;color:#999;margin-top:20px">Si continúas usando la app sin objetar, consideramos que los aceptas.</p>`;
    const emailMessages = users
      .filter((u) => !!u.email)
      .map((u) => ({ from: 'no-reply', to: u.email, subject: `Actualizamos ${TYPE_LABEL[type]}`, html: emailHtml }));
    if (emailMessages.length > 0) await sendBatchEmailsViaResend(emailMessages).catch((err) => console.error('legal email batch error', err));
  }

  return NextResponse.json({ success: true, version: nextVersion });
}
