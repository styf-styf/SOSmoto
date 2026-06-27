import { supabase } from './supabase';
import type { Ad, AdPricing } from '../types/database';

export interface QuoteAdParams {
  targetCity?: string;
  durationDays: number;
}

export async function getAdPricing(): Promise<AdPricing> {
  const { data, error } = await supabase.from('ad_pricing').select('price_per_day_city, price_per_day_national').single();
  if (error) throw error;
  return data as AdPricing;
}

export function quoteAdPrice(pricing: AdPricing, params: QuoteAdParams): number {
  const pricePerDay = params.targetCity ? pricing.price_per_day_city : pricing.price_per_day_national;
  return Math.round(pricePerDay * params.durationDays * 100) / 100;
}

export interface CreateAdCampaignParams {
  businessId: string;
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

// Toda campaña activa (nacional, o de la ciudad dada) es elegible -- el
// negocio ya no elige "dónde" se muestra. Cada pantalla pide la cantidad de
// anuncios que necesita y se elige al azar entre los elegibles, para
// repartir el espacio entre quienes pagaron publicidad en vez de apilarlos
// todos.
async function getEligibleAds(city: string | null): Promise<Ad[]> {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from('ads')
    .select('*')
    .eq('status', 'active')
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso);
  query = city ? query.or(`target_city.is.null,target_city.eq.${city}`) : query.is('target_city', null);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Ad[];
}

function pickRandom(ads: Ad[], count: number): Ad[] {
  const copy = [...ads];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

// Las 3 superficies (inicio, búsqueda, perfil de negocio) usan la misma
// elegibilidad por ciudad -- la única diferencia es de dónde sale la
// "ciudad relevante" para cada pantalla: en el perfil es la ciudad del
// negocio que se está viendo; en inicio/búsqueda es la ciudad del negocio
// más cercano al cliente (ver getNearestCity en services/businesses.ts).
export async function getHomeAds(city: string | null): Promise<Ad[]> {
  return pickRandom(await getEligibleAds(city), 1);
}

export async function getSearchAds(city: string | null): Promise<Ad[]> {
  return pickRandom(await getEligibleAds(city), 1);
}

export async function getActiveProfileAds(city: string | null): Promise<Ad[]> {
  return pickRandom(await getEligibleAds(city), 3);
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
