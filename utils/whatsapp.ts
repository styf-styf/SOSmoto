// Números guardados en el perfil de negocio/cliente vienen en formato local
// ecuatoriano (ej. "0991234567", como se ve en el propio celular) -- wa.me
// exige el formato internacional sin el 0 inicial (ej. "593991234567"), o el
// link no abre ningún chat. Ecuador es el único país que maneja esta app por
// ahora (ver CLAUDE.md), así que el código de país queda fijo en 593.
export function toWhatsappNumber(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('593')) return digits;
  if (digits.startsWith('0')) return `593${digits.slice(1)}`;
  return `593${digits}`;
}

export function toWhatsappLink(raw: string | null | undefined): string {
  return `https://wa.me/${toWhatsappNumber(raw)}`;
}
