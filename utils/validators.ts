const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Celular ecuatoriano: 09XXXXXXXX (10 dígitos) o +5939XXXXXXXX.
const EC_PHONE_REGEX = /^(09\d{8}|\+5939\d{8})$/;
// Formato internacional genérico (cualquier país LatAm): opcional "+código
// de país" seguido de 7 a 12 dígitos -- no se valida un formato exacto por
// país (serían ~18 regex distintas para un MVP), solo un rango razonable de
// longitud total.
const GENERIC_PHONE_REGEX = /^\+?\d{7,15}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.trim().replace(/[\s-()]/g, '');
  return EC_PHONE_REGEX.test(cleaned) || GENERIC_PHONE_REGEX.test(cleaned);
}

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'weak';
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return 'weak';
  if (score <= 3) return 'medium';
  return 'strong';
}
