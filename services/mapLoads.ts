import { supabase } from './supabase';

export async function logMapLoad(screen: string): Promise<void> {
  const { error } = await supabase.rpc('log_map_load', { p_screen: screen });
  if (error) throw error;
}
