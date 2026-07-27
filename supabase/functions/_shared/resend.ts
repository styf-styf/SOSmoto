// Helper compartido para mandar correos transaccionales vía Resend desde
// cualquier Edge Function (recibos de pago, avisos de vencimiento,
// aprobación/rechazo de campañas y KYC, sugerencias de crecimiento). Mismo
// dominio y estilo que admin/lib/resend.ts (usado por la bandeja "Correos"),
// pero ese vive en Next.js -- este es su equivalente para Deno.
const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = 'SOSmoto <no-reply@sosmoto.net>';

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  } as Record<string, string>)[c]);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error('sendEmail: Resend respondió con error', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('sendEmail: excepción al enviar', err);
    return false;
  }
}

// Botón "Ver en SOSmoto" reutilizable -- pasa por https://sosmoto.net/api/abrir
// en vez de un link sosmoto:// crudo, porque los clientes de correo (Gmail
// incluido) no siempre reconocen esquemas custom en un <a href> directo.
export function appButton(to: string, params: Record<string, string> = {}): string {
  const qs = new URLSearchParams(params).toString();
  const href = `https://sosmoto.net/api/abrir?to=${encodeURIComponent(to)}${qs ? `&${qs}` : ''}`;
  return `<a href="${href}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#FF6B00;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Ver en SOSmoto</a>`;
}
