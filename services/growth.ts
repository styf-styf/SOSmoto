import { supabase } from './supabase';
import type { GrowthSuggestion } from '../types/database';

export async function getActiveGrowthSuggestion(businessId: string): Promise<GrowthSuggestion | null> {
  const { data, error } = await supabase
    .from('growth_suggestions')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as GrowthSuggestion | null;
}

export async function dismissGrowthSuggestion(id: string): Promise<void> {
  const { error } = await supabase.from('growth_suggestions').update({ status: 'dismissed' }).eq('id', id);
  if (error) throw error;
}
