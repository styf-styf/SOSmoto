import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { sendEmailViaResend } from '../../../../lib/resend';

function textToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    .join('<br/>');
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { from, to, subject, body, inReplyTo, threadReferences } = await req.json();
  if (!from || !to || !subject || !body) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: aliasRow } = await supabase.from('email_aliases').select('alias').eq('alias', from).maybeSingle();
  if (!aliasRow) return NextResponse.json({ error: 'Alias de origen no configurado' }, { status: 400 });

  const html = textToHtml(String(body));

  let sendResult;
  try {
    sendResult = await sendEmailViaResend({
      from: String(from).split('@')[0],
      to: String(to),
      subject: String(subject),
      html,
      text: String(body),
      inReplyTo: inReplyTo ?? null,
      references: threadReferences ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error enviando el correo' }, { status: 502 });
  }

  const { error: insertError } = await supabase.from('emails').insert({
    id: sendResult.id,
    type: 'sent',
    alias: from,
    from_address: from,
    to_address: to,
    subject,
    html,
    text: body,
    message_id: sendResult.messageId,
    in_reply_to: inReplyTo ?? null,
    thread_references: threadReferences ?? null,
    read: true,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ success: true, id: sendResult.id });
}
