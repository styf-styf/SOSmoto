import { supabase } from './supabase';

export async function getLatestLegalPublishedAt(): Promise<string | null> {
  const { data } = await supabase
    .from('legal_documents')
    .select('published_at')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.published_at ?? null;
}

export async function acknowledgeLegalUpdate(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ legal_ack_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}
