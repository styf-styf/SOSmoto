import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET')!;
const MAX_TIMESTAMP_DRIFT_SECONDS = 5 * 60;

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Comparación en tiempo constante -- evita timing attacks al validar la firma.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Resend firma sus webhooks con el estándar Svix: HMAC-SHA256 sobre
// "{svix-id}.{svix-timestamp}.{raw body}", con el secreto en base64
// (prefijo "whsec_"). Debe verificarse sobre el body CRUDO, antes de
// parsear el JSON -- cualquier re-serialización cambia la firma.
async function verifySvixSignature(rawBody: string, headers: Headers): Promise<boolean> {
  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const timestampSeconds = Number(svixTimestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_TIMESTAMP_DRIFT_SECONDS) {
    console.warn('email-webhook: svix-timestamp fuera de rango, posible replay', { svixId, svixTimestamp });
    return false;
  }

  const secretRaw = RESEND_WEBHOOK_SECRET.startsWith('whsec_')
    ? RESEND_WEBHOOK_SECRET.slice('whsec_'.length)
    : RESEND_WEBHOOK_SECRET;
  const secretBytes = base64Decode(secretRaw);

  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const signatureBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent)));
  const expectedSignature = base64Encode(signatureBytes);

  // svix-signature puede traer varias firmas espacio-separadas ("v1,firma1 v1,firma2"),
  // una por cada secreto activo durante una rotación -- basta con que UNA coincida.
  const candidates = svixSignature
    .split(' ')
    .map((entry) => entry.split(',')[1])
    .filter((sig): sig is string => Boolean(sig));

  return candidates.some((candidate) => timingSafeEqual(candidate, expectedSignature));
}

interface ResendReceivingEmail {
  from: string;
  to: string[];
  subject: string | null;
  html: string | null;
  text: string | null;
  created_at: string;
  headers?: Array<{ name: string; value: string }>;
}

function extractHeader(headers: ResendReceivingEmail['headers'], name: string): string | null {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

// El payload del webhook trae solo metadata (email_id, from, to, subject);
// el cuerpo completo (html/text/headers) hay que pedirlo aparte a la API de
// recepción de Resend. Fetch directo, sin el SDK npm "resend" -- mismo
// estilo que admin/lib/push.ts para Expo push.
async function fetchReceivedEmail(emailId: string): Promise<ResendReceivingEmail> {
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`No se pudo obtener el correo recibido ${emailId}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function normalizeAddress(address: string): string {
  // "Nombre <correo@dominio>" -> "correo@dominio"
  const match = address.match(/<([^>]+)>/);
  return (match ? match[1] : address).trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const rawBody = await req.text();

  const validSignature = await verifySvixSignature(rawBody, req.headers);
  if (!validSignature) {
    console.error('email-webhook: firma svix inválida o ausente');
    return new Response(JSON.stringify({ error: 'Firma inválida' }), { status: 401 });
  }

  let payload: { type?: string; data?: { email_id?: string; id?: string } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400 });
  }

  // Solo nos interesan los correos entrantes; el resto de eventos de Resend
  // (email.sent, email.delivered, email.bounced, etc.) se reconocen con 200
  // para que Resend no los siga reintentando, pero no generan una fila.
  if (payload.type !== 'email.received') {
    return new Response(JSON.stringify({ received: true, ignored: payload.type }), { status: 200 });
  }

  const emailId = payload.data?.email_id ?? payload.data?.id;
  if (!emailId) {
    return new Response(JSON.stringify({ error: 'Falta email_id en el payload' }), { status: 400 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Idempotencia: Resend puede reintentar el webhook si no respondemos a
  // tiempo -- si el id ya existe, respondemos 200 sin duplicar la fila.
  const { data: existing } = await supabase.from('emails').select('id').eq('id', emailId).maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  const full = await fetchReceivedEmail(emailId);
  const toAddress = normalizeAddress(full.to[0] ?? '');
  const fromAddress = normalizeAddress(full.from);

  const { data: aliasRow } = await supabase.from('email_aliases').select('alias').eq('alias', toAddress).maybeSingle();

  const { error: insertError } = await supabase.from('emails').insert({
    id: emailId,
    type: 'received',
    alias: aliasRow?.alias ?? toAddress,
    from_address: fromAddress,
    to_address: toAddress,
    subject: full.subject ?? '(sin asunto)',
    html: full.html,
    text: full.text,
    message_id: extractHeader(full.headers, 'Message-ID'),
    in_reply_to: extractHeader(full.headers, 'In-Reply-To'),
    thread_references: extractHeader(full.headers, 'References'),
    read: false,
    created_at: full.created_at,
  });

  if (insertError) {
    console.error('email-webhook: error insertando correo recibido', insertError);
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
