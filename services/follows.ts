import { supabase } from './supabase';

export async function isFollowing(clientId: string, businessId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('client_id', clientId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function followBusiness(clientId: string, businessId: string) {
  const { error } = await supabase
    .from('follows')
    .insert({ client_id: clientId, business_id: businessId });

  if (error) throw error;
}

export async function unfollowBusiness(clientId: string, businessId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('client_id', clientId)
    .eq('business_id', businessId);

  if (error) throw error;
}
