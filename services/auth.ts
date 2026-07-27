import { supabase } from './supabase';
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
