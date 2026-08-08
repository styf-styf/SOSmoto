import { supabase } from './supabase';

export async function submitPilotFeedback(userId: string, message: string): Promise<void> {
  const { error } = await supabase.from('pilot_feedback').insert({ user_id: userId, message: message.trim() });
  if (error) throw error;
}
