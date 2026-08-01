import { supabase } from './supabase';
import { removeSavedAccount } from './accountSwitcher';
import type { UserRole } from '../types/database';

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: Exclude<UserRole, 'admin'>;
}

export async function signUp({ email, password, fullName, phone, role }: SignUpParams) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone ?? null,
        role,
      },
      emailRedirectTo: 'sosmoto://auth-callback?flow=signup',
    },
  });
  if (error) throw error;
  // Supabase nunca lanza error si el correo ya tiene cuenta confirmada (evita
  // que alguien use el registro para sondear qué correos existen) -- en su
  // lugar devuelve éxito con `identities: []`, la única señal de que en
  // realidad no se creó nada nuevo. Sin este chequeo, un correo ya
  // registrado caía derecho a la pantalla de verificación sin avisar nada.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    throw new Error('User already registered');
  }
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Botón de pánico: revoca esta sesión Y cualquier otra (otro celular, el
// acceso rápido guardado en cualquier dispositivo) -- scope 'global' tumba
// el refresh token en el servidor sin importar dónde se esté usando. Se
// limpia también el acceso rápido guardado de ESTE dispositivo -- en otros
// dispositivos el token guardado queda ahí pero ya inválido, y se
// autolimpia solo la próxima vez que intenten usarlo (ver switchToAccount).
export async function signOutEverywhere(userId: string) {
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) throw error;
  await removeSavedAccount(userId).catch(() => undefined);
}

export async function sendPasswordResetEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'sosmoto://auth-callback?flow=recovery',
  });
  if (error) throw error;
}

export async function verifySignupCode(email: string, code: string) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
  if (error) throw error;
  return data;
}

export async function resendSignupCode(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

export async function verifyRecoveryCode(email: string, code: string) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
  if (error) throw error;
  return data;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
