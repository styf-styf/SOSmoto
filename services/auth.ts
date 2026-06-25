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
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  const userId = data.user?.id;
  if (!userId) throw new Error('No se pudo crear el usuario.');

  const { error: profileError } = await supabase.from('users').insert({
    id: userId,
    email,
    phone: phone ?? null,
    full_name: fullName,
    role,
  });
  if (profileError) throw profileError;

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
