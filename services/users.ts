import { supabase } from './supabase';
import type { User } from '../types/database';

export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as User | null;
}

export interface UpdateUserProfileParams {
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

export async function updateUserProfile(userId: string, params: UpdateUserProfileParams): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...(params.fullName !== undefined ? { full_name: params.fullName } : {}),
      ...(params.phone !== undefined ? { phone: params.phone } : {}),
      ...(params.avatarUrl !== undefined ? { avatar_url: params.avatarUrl } : {}),
    })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as User;
}

export async function getUsersByIds(
  ids: string[]
): Promise<Array<{ id: string; full_name: string; avatar_url: string | null }>> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('users').select('id, full_name, avatar_url').in('id', ids);
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; full_name: string; avatar_url: string | null }>;
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
