// Números guardados en el perfil de negocio/cliente vienen en formato local
// (ej. "0991234567", como se ve en el propio celular) -- wa.me exige el
// formato internacional sin el 0 inicial (ej. "593991234567"), o el link no
// abre ningún chat. `dialCode` viene de dialCodeForCountry(business.country)
// en cada call site -- los clientes no tienen país propio guardado, así que
// se usa el país del negocio desde donde se contacta como mejor estimación
// disponible. Default '593' (Ecuador) para los call sites que todavía no
// pasan el código explícito.
export function toWhatsappNumber(raw: string | null | undefined, dialCode = '593'): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith(dialCode)) return digits;
  if (digits.startsWith('0')) return `${dialCode}${digits.slice(1)}`;
  return `${dialCode}${digits}`;
}

export function toWhatsappLink(raw: string | null | undefined, message?: string, dialCode = '593'): string {
  const base = `https://wa.me/${toWhatsappNumber(raw, dialCode)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
