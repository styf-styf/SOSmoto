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

export interface PaymentHistoryRow {
  id: string;
  amount: number;
  currency: string;
  type: 'subscription' | 'advertising';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  created_at: string;
}

// Historial de pagos/facturas del negocio (suscripción + publicidad) -- ver
// CLAUDE.md, "Suscripción y facturación" lo pide explícitamente y hasta
// ahora ninguna pantalla del negocio lo mostraba.
export async function getPaymentHistory(businessId: string): Promise<PaymentHistoryRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, currency, type, status, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as PaymentHistoryRow[];
}
