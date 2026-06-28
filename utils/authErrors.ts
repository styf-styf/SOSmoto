// Traduce los mensajes crudos (en inglés) que devuelve Supabase Auth a algo
// que un usuario final pueda entender. Si no reconocemos el mensaje, se
// devuelve tal cual (mejor mostrar algo que nada).
export function translateAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('already registered')) {
    return 'Ya existe una cuenta con este correo.';
  }
  if (lower.includes('password should be at least')) {
    return 'La contraseña es demasiado corta.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (lower.includes('unable to validate email address') || (lower.includes('email address') && lower.includes('invalid'))) {
    return 'Ese correo no es válido.';
  }
  if (lower.includes('rate limit')) {
    return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  }
  if (lower.includes('network request failed')) {
    return 'No se pudo conectar. Revisa tu conexión a internet.';
  }

  return message;
}
