import { supabase } from './supabase';

export interface ChatQuote {
  id: string;
  business_id: string;
  client_id: string;
  kind: 'product' | 'service';
  label: string;
  product_id: string | null;
  variant_id: string | null;
  quantity: number | null;
  service_id: string | null;
  unit_price: number | null;
  status: 'pending' | 'resolved' | 'cancelled' | 'dismissed';
  created_at: string;
}

export interface CreateChatQuoteParams {
  businessId: string;
  clientId: string;
  kind: 'product' | 'service';
  label: string;
  productId?: string | null;
  variantId?: string | null;
  quantity?: number | null;
  serviceId?: string | null;
  unitPrice?: number | null;
}

export async function createChatQuote(params: CreateChatQuoteParams): Promise<ChatQuote> {
  const { data, error } = await supabase
    .from('chat_quotes')
    .insert({
      business_id: params.businessId,
      client_id: params.clientId,
      kind: params.kind,
      label: params.label,
      product_id: params.productId ?? null,
      variant_id: params.variantId ?? null,
      quantity: params.quantity ?? null,
      service_id: params.serviceId ?? null,
      unit_price: params.unitPrice ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ChatQuote;
}

export async function getPendingChatQuotes(businessId: string, clientId: string): Promise<ChatQuote[]> {
  const { data, error } = await supabase
    .from('chat_quotes')
    .select('*')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ChatQuote[];
}

export async function resolveChatQuote(id: string): Promise<void> {
  const { error } = await supabase.from('chat_quotes').update({ status: 'resolved' }).eq('id', id);
  if (error) throw error;
}

export async function cancelChatQuote(id: string): Promise<void> {
  const { error } = await supabase.from('chat_quotes').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
}
