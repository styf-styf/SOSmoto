// Fetch directo a la API de Resend -- sin instalar el paquete npm "resend",
// mismo estilo que admin/lib/push.ts para Expo push.
const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_DOMAIN = 'sosmoto.net';
const FROM_BRAND = 'SOSmoto';

// Mismo helper que supabase/functions/_shared/resend.ts -- nombres de
// negocio/usuario son datos del propio usuario, no de un tercero de
// confianza; se interpolan en HTML de correo y deben escaparse.
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SendEmailParams {
  from: string; // local-part, ej. "soporte"
  to: string;
  subject: string;
  html: string;
  text?: string;
  inReplyTo?: string | null;
  references?: string | null;
}

export interface SendEmailResult {
  id: string;
  messageId: string;
}

// Envío masivo (ej. aviso de cambio de Términos/Privacidad a todos los
// usuarios) -- usa /emails/batch de Resend (hasta 100 por request, un solo
// "from" pero "to" distinto por email) en vez de loopear sendEmailViaResend
// una por una.
export interface BatchEmailParams {
  from: string; // local-part, ej. "no-reply"
  to: string;
  subject: string;
  html: string;
}

const BATCH_CHUNK_SIZE = 100;

export async function sendBatchEmailsViaResend(emails: BatchEmailParams[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY no está configurado');

  for (let i = 0; i < emails.length; i += BATCH_CHUNK_SIZE) {
    const chunk = emails.slice(i, i + BATCH_CHUNK_SIZE).map((e) => ({
      from: `${FROM_BRAND} <${e.from}@${FROM_DOMAIN}>`,
      to: [e.to],
      subject: e.subject,
      html: e.html,
    }));
    const res = await fetch(`${RESEND_API_URL}/batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('sendBatchEmailsViaResend: Resend respondió con error', body);
    }
  }
}

export async function sendEmailViaResend(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY no está configurado');

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${FROM_BRAND} <${params.from}@${FROM_DOMAIN}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      headers: {
        ...(params.inReplyTo ? { 'In-Reply-To': params.inReplyTo } : {}),
        ...(params.references ? { References: params.references } : {}),
      },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message ?? `Resend respondió ${res.status}`);
  }

  return { id: body.id as string, messageId: `<${body.id}@${FROM_DOMAIN}>` };
}
