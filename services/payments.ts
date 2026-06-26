import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

async function describeFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return body.detail ? `${body.error}: ${body.detail}` : body.error;
    } catch {
      // el cuerpo no era JSON, seguimos con el mensaje genérico
    }
  }
  return error instanceof Error ? error.message : 'Error desconocido';
}

export interface PreparedCheckout {
  paymentId: string;
  checkoutUrl: string;
}

export async function startSubscriptionCheckout(businessId: string, planId: string): Promise<PreparedCheckout> {
  const { data, error } = await supabase.functions.invoke('payphone-prepare', {
    body: { businessId, planId },
  });
  if (error) throw new Error(await describeFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return data as PreparedCheckout;
}

export interface ConfirmPaymentResult {
  success: boolean;
  status?: string;
  alreadyConfirmed?: boolean;
}

export async function confirmSubscriptionPayment(
  id: string,
  clientTransactionId: string
): Promise<ConfirmPaymentResult> {
  const { data, error } = await supabase.functions.invoke('payphone-confirm', {
    body: { id, clientTransactionId },
  });
  if (error) throw new Error(await describeFunctionError(error));
  if (data?.error) throw new Error(data.error);
  return data as ConfirmPaymentResult;
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
