import { supabase } from './supabase';
import type { Ad, AdComment, AdPricing, BusinessType } from '../types/database';

export interface AdWithBusiness extends Ad {
  business: { name: string; logo_url: string | null; is_verified: boolean; business_type?: BusinessType } | null;
}

// El anuncio se ve y se comporta como una publicación del feed (con
// comentarios) -- mismo patrón que getPostById/getComments/createComment en
// services/posts.ts.
export async function getAdById(adId: string): Promise<AdWithBusiness | null> {
  const { data, error } = await supabase
    .from('ads')
    .select('*, business:businesses(name, logo_url, is_verified)')
    .eq('id', adId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as AdWithBusiness | null;
}

export interface AdCommentWithAuthor extends AdComment {
  users: { id: string; full_name: string; avatar_url: string | null } | null;
}

export async function getAdComments(adId: string): Promise<AdCommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('ad_comments')
    .select('*, users(id, full_name, avatar_url)')
    .eq('ad_id', adId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AdCommentWithAuthor[];
}

export async function createAdComment(adId: string, authorId: string, body: string): Promise<AdComment> {
  const { data, error } = await supabase
    .from('ad_comments')
    .insert({ ad_id: adId, author_id: authorId, body: body.trim() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AdComment;
}

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
async function getEligibleAds(city: string | null, businessTypes?: BusinessType[]): Promise<AdWithBusiness[]> {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from('ads')
    .select('*, business:businesses(name, logo_url, is_verified, business_type)')
    .eq('status', 'active')
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso)
    .order('created_at', { ascending: false });
  query = city ? query.or(`target_city.is.null,target_city.eq.${city}`) : query.is('target_city', null);
  const { data, error } = await query;
  if (error) throw error;
  const ads = (data ?? []) as unknown as AdWithBusiness[];
  if (!businessTypes?.length) return ads;
  return ads.filter((ad) => ad.business?.business_type && businessTypes.includes(ad.business.business_type));
}

function pickRandom<T>(ads: T[], count: number): T[] {
  const copy = [...ads];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

// Las superficies (inicio, búsqueda, perfil de negocio) usan la misma
// elegibilidad por ciudad -- la única diferencia es de dónde sale la
// "ciudad relevante" para cada pantalla: en el perfil es la ciudad del
// negocio que se está viendo; en inicio/búsqueda es la ciudad del negocio
// más cercano al cliente (ver getNearestCity en services/businesses.ts).
// getFeedAds devuelve varios (no solo 1) ordenados por más reciente primero
// -- el propio HomeFeed decide si los muestra en ese orden (primera carga) o
// mezclados (recargas), para darle prioridad a contenido nuevo sin perder
// variedad cuando no hay nada nuevo.
export async function getFeedAds(city: string | null, count = 15): Promise<AdWithBusiness[]> {
  return (await getEligibleAds(city)).slice(0, count);
}

export async function getSearchAds(city: string | null): Promise<AdWithBusiness[]> {
  return getEligibleAds(city);
}

// Para el buscador del negocio (taller): solo anuncios de tiendas y marcas,
// nunca de otros talleres -- ademas de no tener sentido (un taller no puede
// interactuar con el perfil de otro taller), mezclar anunciantes que no son
// el publico objetivo (clientes) infla las metricas de impresiones/clics
// que se le venden al anunciante como alcance real.
export async function getSearchAdsForBusinessViewer(city: string | null): Promise<AdWithBusiness[]> {
  return getEligibleAds(city, ['store', 'brand_advertiser']);
}

export async function getActiveProfileAds(city: string | null): Promise<AdWithBusiness[]> {
  return pickRandom(await getEligibleAds(city), 3);
}

export async function registerAdImpression(adId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_ad_metric', { ad_id: adId, metric: 'impression' });
  if (error) console.error('registerAdImpression error', error);
}

export async function registerAdClick(adId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_ad_metric', { ad_id: adId, metric: 'click' });
  if (error) console.error('registerAdClick error', error);
}

export async function pauseAd(adId: string): Promise<Ad> {
  const { data, error } = await supabase.from('ads').update({ status: 'expired' }).eq('id', adId).select().single();
  if (error) throw error;
  return data as Ad;
}
