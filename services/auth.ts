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
    },
  });
  if (error) throw error;
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
