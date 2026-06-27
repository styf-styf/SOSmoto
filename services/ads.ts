import { supabase } from './supabase';
import type { Ad, AdPricing, AdType } from '../types/database';

export interface QuoteAdParams {
  type: AdType;
  targetCity?: string;
  durationDays: number;
}

export async function getAdPricing(): Promise<AdPricing[]> {
  const { data, error } = await supabase.from('ad_pricing').select('*');
  if (error) throw error;
  return (data ?? []) as AdPricing[];
}

export function quoteAdPrice(pricing: AdPricing[], params: QuoteAdParams): number {
  const row = pricing.find((p) => p.ad_type === params.type);
  if (!row) return 0;
  const pricePerDay = params.targetCity ? row.price_per_day_city : row.price_per_day_national;
  return Math.round(pricePerDay * params.durationDays * 100) / 100;
}

export interface CreateAdCampaignParams {
  businessId: string;
  type: AdType;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  targetCity?: string;
  durationDays: number;
}

// El anuncio NO se crea aquí -- solo se crea el pago. La fila en `ads` la
// crea payphone-confirm (o el fallback en payphone-return.js) recién cuando
// Payphone aprueba el pago, con status 'pending_review' para que el admin
// la apruebe antes de mostrarse a clientes.
export async function createAdCampaign(
  params: CreateAdCampaignParams
): Promise<{ paymentId: string; amount: number; checkoutUrl: string }> {
  const { data, error } = await supabase.functions.invoke('ad-prepare', {
    body: {
      businessId: params.businessId,
      type: params.type,
      title: params.title,
      imageUrl: params.imageUrl,
      linkUrl: params.linkUrl,
      targetCity: params.targetCity,
      durationDays: params.durationDays,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getBusinessAds(businessId: string): Promise<Ad[]> {
  const { data, error } = await supabase
    .from('ads')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Ad[];
}

// Por ahora solo se muestran campañas nacionales (target_city null): no hay
// todavía un concepto de "ciudad del cliente" para filtrar por target_city.
export async function getActiveHomeBanners(): Promise<Ad[]> {
  return getActiveAdsByType('home_banner');
}

export async function getActiveSearchFeatured(): Promise<Ad[]> {
  return getActiveAdsByType('search_featured');
}

// profile_ad sí se filtra por la ciudad del negocio que se está viendo
// (o nacional) -- a diferencia de home_banner/search_featured, que no tienen
// todavía un concepto de "ciudad del cliente" para comparar.
export async function getActiveProfileAds(city: string | null): Promise<Ad[]> {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from('ads')
    .select('*')
    .eq('type', 'profile_ad')
    .eq('status', 'active')
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso)
    .order('created_at', { ascending: false });
  query = city ? query.or(`target_city.is.null,target_city.eq.${city}`) : query.is('target_city', null);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Ad[];
}

async function getActiveAdsByType(type: AdType): Promise<Ad[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('ads')
    .select('*')
    .eq('type', type)
    .eq('status', 'active')
    .is('target_city', null)
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Ad[];
}

export async function registerAdImpression(adId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_ad_metric', { ad_id: adId, metric: 'impression' });
  if (error) throw error;
}

export async function registerAdClick(adId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_ad_metric', { ad_id: adId, metric: 'click' });
  if (error) throw error;
}

export async function pauseAd(adId: string): Promise<Ad> {
  const { data, error } = await supabase.from('ads').update({ status: 'expired' }).eq('id', adId).select().single();
  if (error) throw error;
  return data as Ad;
}
