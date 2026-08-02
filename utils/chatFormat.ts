const QUOTE_PREFIX = '__QUOTE__';
const CATALOG_SHARE_BODY = '__CATALOG_SHARE__';

// Mensaje canned que un negocio manda cuando el cliente le pide el catálogo
// -- sin payload propio, el negocio ya es fijo dentro de un chat puntual
// (a diferencia de la cotización, no hace falta codificar nada más).
export function encodeCatalogShare(): string {
  return CATALOG_SHARE_BODY;
}

export function isCatalogShare(body: string): boolean {
  return body === CATALOG_SHARE_BODY;
}

export interface QuotePayload {
  // Ausente en cotizaciones viejas (antes de que tienda tuviera su propio
  // formulario) -- se trata como 'service' al leerlas, mismo comportamiento
  // que siempre tuvieron. `service`/`time` se reusan tal cual para
  // 'product' (guardan nombre de producto / cantidad respectivamente) en
  // vez de sumar campos nuevos que dupliquen el mismo dato.
  kind?: 'service' | 'product';
  service: string;
  price: string;
  time: string;
}

export function encodeQuote(payload: QuotePayload): string {
  return `${QUOTE_PREFIX}${JSON.stringify(payload)}`;
}

export function parseQuote(body: string): QuotePayload | null {
  if (!body.startsWith(QUOTE_PREFIX)) return null;
  try {
    return JSON.parse(body.slice(QUOTE_PREFIX.length)) as QuotePayload;
  } catch {
    return null;
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
}

export function formatMessageDateLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return 'Hoy';
  if (isSameDay(date, yesterday)) return 'Ayer';
  return date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function shouldShowDateSeparator(messages: { created_at: string }[], index: number): boolean {
  if (index === 0) return true;
  return !isSameDay(new Date(messages[index - 1].created_at), new Date(messages[index].created_at));
}

export function formatConversationTimestamp(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  if (isSameDay(date, today)) return formatMessageTime(iso);
  return formatMessageDateLabel(iso);
}
