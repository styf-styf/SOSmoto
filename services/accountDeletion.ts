import { supabase } from './supabase';
import type { AccountDeletionRequest } from '../types/database';

export async function getPendingDeletionRequest(userId: string): Promise<AccountDeletionRequest | null> {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw error;
  return data as AccountDeletionRequest | null;
}

export async function requestAccountDeletion(userId: string, reason: string | null): Promise<AccountDeletionRequest> {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .insert({ user_id: userId, reason: reason?.trim() || null })
    .select()
    .single();
  if (error) throw error;
  return data as AccountDeletionRequest;
}

export async function cancelAccountDeletion(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('account_deletion_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId);
  if (error) throw error;
}
