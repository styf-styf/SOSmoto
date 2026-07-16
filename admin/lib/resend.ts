// Fetch directo a la API de Resend -- sin instalar el paquete npm "resend",
// mismo estilo que admin/lib/push.ts para Expo push.
const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_DOMAIN = 'sosmoto.app';
const FROM_BRAND = 'SOSmoto';

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
