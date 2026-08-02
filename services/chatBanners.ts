import { supabase } from './supabase';

// Persiste qué banners del chat (solicitud de cita, apartado, cita
// confirmada, cotización...) cerró cada lado con la X -- sin esto,
// dismissedBanners era estado local puro y se perdía al reabrir el chat.
export async function getHiddenBannerKeys(
  businessId: string,
  clientId: string,
  hiddenBy: 'client' | 'business'
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('hidden_chat_banners')
    .select('banner_key')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .eq('hidden_by', hiddenBy);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.banner_key as string));
}

export async function hideChatBanner(
  businessId: string,
  clientId: string,
  bannerKey: string,
  hiddenBy: 'client' | 'business'
): Promise<void> {
  const { error } = await supabase
    .from('hidden_chat_banners')
    .upsert(
      { business_id: businessId, client_id: clientId, banner_key: bannerKey, hidden_by: hiddenBy, hidden_at: new Date().toISOString() },
      { onConflict: 'business_id,client_id,banner_key,hidden_by' }
    );
  if (error) throw error;
}
