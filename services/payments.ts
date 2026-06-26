import { supabase } from './supabase';

export async function getWebLoginCode(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('web-login-ticket', { body: {} });
  if (error) throw error;
  return data.code;
}

export async function getActiveSubscription(businessId: string) {
  const { data, error } = await supabase
    .from('business_subscriptions')
    .select('id, plan_id, status, started_at, expires_at')
    .eq('business_id', businessId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
