import { supabase } from './supabase';
import { distanceKm } from '../utils/distance';
import type { FeedCatalogItem } from './catalog';
import type { Ad, AdComment, AdKind, AdPricing, AdTargetScope, BusinessType } from '../types/database';

type Coords = { latitude: number; longitude: number };

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
  targetScope: AdTargetScope;
  // Solo relevante cuando targetScope es 'radius'.
  targetRadiusKm?: number;
  durationDays: number;
}

export async function getAdPricing(): Promise<AdPricing> {
  const { data, error } = await supabase
    .from('ad_pricing')
    .select('price_per_day_city, price_per_day_national, radius_reference_km, radius_cap_km')
    .single();
  if (error) throw error;
  return data as AdPricing;
}

// El radio no tiene un precio propio fijado por el admin -- se interpola
// linealmente entre el precio de ciudad y el de nacional, usando dos anclas
// en KM (radius_reference_km/radius_cap_km) en vez de dólares fijos. Así,
// si el admin cambia las tarifas de ciudad/nacional, el precio del radio se
// reajusta solo sin tener que resincronizar nada a mano.
function quoteAdPricePerDay(pricing: AdPricing, params: QuoteAdParams): number {
  if (params.targetScope === 'national') return pricing.price_per_day_national;
  if (params.targetScope === 'city') return pricing.price_per_day_city;

  const km = params.targetRadiusKm ?? 0;
  const span = pricing.radius_cap_km - pricing.radius_reference_km;
  const rate = span > 0 ? (pricing.price_per_day_national - pricing.price_per_day_city) / span : 0;
  const base = pricing.price_per_day_city - rate * pricing.radius_reference_km;
  const perDay = base + rate * km;
  return Math.min(Math.max(perDay, 0), pricing.price_per_day_national);
}

export function quoteAdPrice(pricing: AdPricing, params: QuoteAdParams): number {
  return Math.round(quoteAdPricePerDay(pricing, params) * params.durationDays * 100) / 100;
}

export interface CreateAdCampaignParams {
  businessId: string;
  kind: AdKind;
  // Si se ancla a un producto/servicio "ya publicado" del propio catálogo.
  // La categoría se asigna automáticamente del lado del servidor a partir de
  // ese ítem (ver ad-prepare) -- categoryId acá solo aplica cuando se crea
  // un ítem nuevo exclusivo para el anuncio (productId/serviceId ausentes).
  productId?: string;
  serviceId?: string;
  categoryId?: string;
  // Nombre real del producto/servicio anunciado -- lo que se compara contra
  // lo que el cliente busca (ver searchActiveAds). Si se ancló a un ítem
  // existente, es su nombre; si es un ítem nuevo solo para el anuncio, es el
  // nombre que el negocio le puso acá.
  itemName: string;
  title: string;
  photos: string[];
  linkUrl?: string;
  targetScope: AdTargetScope;
  // Solo aplica cuando targetScope es 'city'.
  targetCity?: string;
  // Solo aplica cuando targetScope es 'radius' -- lat/lng los resuelve el
  // servidor a partir de la ubicación real del negocio, no se mandan acá.
  targetRadiusKm?: number;
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
      kind: params.kind,
      productId: params.productId,
      serviceId: params.serviceId,
      categoryId: params.categoryId,
      itemName: params.itemName,
      title: params.title,
      photos: params.photos,
      linkUrl: params.linkUrl,
      targetScope: params.targetScope,
      targetCity: params.targetCity,
      targetRadiusKm: params.targetRadiusKm,
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

// Radio máximo de anuncio soportado -- acota el bounding box de la consulta
// SQL (barata) antes de filtrar por distancia exacta (haversine, en JS).
// Mismo patrón de dos pasos que getNearbyBusinesses en services/businesses.ts.
const MAX_RADIUS_AD_BOUNDING_KM = 200;

interface RadiusAdsFilter {
  itemNameIlike?: string;
  kinds?: AdKind[];
}

async function getEligibleRadiusAds(
  coords: Coords,
  nowIso: string,
  filter: RadiusAdsFilter = {}
): Promise<AdWithBusiness[]> {
  const latDelta = MAX_RADIUS_AD_BOUNDING_KM / 111;
  const lngDelta = MAX_RADIUS_AD_BOUNDING_KM / (111 * Math.cos((coords.latitude * Math.PI) / 180));
  let query = supabase
    .from('ads')
    .select('*, business:businesses(name, logo_url, is_verified, business_type)')
    .eq('status', 'active')
    .eq('target_scope', 'radius')
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso)
    .gte('target_lat', coords.latitude - latDelta)
    .lte('target_lat', coords.latitude + latDelta)
    .gte('target_lng', coords.longitude - lngDelta)
    .lte('target_lng', coords.longitude + lngDelta);
  if (filter.itemNameIlike) query = query.ilike('item_name', `%${filter.itemNameIlike}%`);
  if (filter.kinds?.length) query = query.in('kind', filter.kinds);

  const { data, error } = await query;
  if (error) throw error;
  const ads = (data ?? []) as unknown as AdWithBusiness[];
  return ads.filter(
    (ad) =>
      ad.target_lat !== null &&
      ad.target_lng !== null &&
      ad.target_radius_km !== null &&
      distanceKm(coords.latitude, coords.longitude, ad.target_lat, ad.target_lng) <= ad.target_radius_km
  );
}

// Toda campaña activa (nacional, de la ciudad dada, o dentro del radio de la
// ubicación dada) es elegible -- el negocio ya no elige "dónde" se muestra.
// Cada pantalla pide la cantidad de anuncios que necesita y se elige al azar
// entre los elegibles, para repartir el espacio entre quienes pagaron
// publicidad en vez de apilarlos todos.
//
// `coords` es opcional a propósito: el anuncio en el perfil de un negocio
// (getActiveProfileAds) no pasa coords -- ahí la "audiencia" es quien visita
// ese perfil puntual, no gente físicamente cerca del negocio, así que el
// radio no participa en esa superficie, solo en home/búsqueda.
async function getEligibleAds(
  city: string | null,
  coords: Coords | null = null,
  businessTypes?: BusinessType[]
): Promise<AdWithBusiness[]> {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from('ads')
    .select('*, business:businesses(name, logo_url, is_verified, business_type)')
    .eq('status', 'active')
    .neq('target_scope', 'radius')
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso)
    .order('created_at', { ascending: false });
  query = city ? query.or(`target_city.is.null,target_city.eq.${city}`) : query.is('target_city', null);
  const { data, error } = await query;
  if (error) throw error;
  let ads = (data ?? []) as unknown as AdWithBusiness[];

  if (coords) {
    ads = [...ads, ...(await getEligibleRadiusAds(coords, nowIso))];
  }

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
export async function getFeedAds(city: string | null, coords: Coords | null = null, count = 15): Promise<AdWithBusiness[]> {
  return (await getEligibleAds(city, coords)).slice(0, count);
}

export async function getActiveProfileAds(city: string | null): Promise<AdWithBusiness[]> {
  return pickRandom(await getEligibleAds(city), 3);
}

function adToFeedCatalogItem(ad: AdWithBusiness): FeedCatalogItem {
  return {
    kind: ad.kind,
    id: ad.id,
    businessId: ad.business_id,
    businessName: ad.business?.name ?? '',
    businessLogoUrl: ad.business?.logo_url ?? undefined,
    name: ad.title,
    referencePrice: null,
    photoUrl: ad.photos[0],
    createdAt: ad.created_at,
    isAd: true,
    adId: ad.id,
  };
}

// Anuncios activos mezclados como si fueran tarjetas de catálogo más, para
// el carrusel de productos/servicios del home (ver components/HomeFeed.tsx)
// -- a diferencia de getFeedAds (banner separado en el feed, que se
// mantiene tal cual), acá compiten visualmente con productos/servicios
// reales, marcados con el chip "Anuncio" (ver FeedCatalogStrip.tsx).
export async function getActiveAdsCatalogItems(
  city: string | null,
  coords: Coords | null,
  limit = 5,
  opts: { excludeBrand?: boolean } = {}
): Promise<FeedCatalogItem[]> {
  const ads = await getEligibleAds(city, coords);
  const filtered = opts.excludeBrand ? ads.filter((ad) => ad.business?.business_type !== 'brand_advertiser') : ads;
  return pickRandom(filtered, limit).map(adToFeedCatalogItem);
}

// Un solo anuncio activo que coincida con lo que el cliente está buscando
// (mismo ilike que products.name/services.name en searchCatalog) -- se
// muestra como el primer resultado dentro de "Resultados" en el buscador,
// ya no en una sección de "Publicidad" aparte (ver app/(client)/(tabs)/buscar.tsx
// y app/(business)/buscar.tsx).
export async function searchActiveAds(
  query: string,
  city: string | null,
  coords: Coords | null,
  opts: { kinds?: AdKind[]; businessTypeIn?: BusinessType[] } = {}
): Promise<FeedCatalogItem | null> {
  const term = query.trim();
  if (!term) return null;
  const nowIso = new Date().toISOString();
  let dbQuery = supabase
    .from('ads')
    .select('*, business:businesses(name, logo_url, is_verified, business_type)')
    .eq('status', 'active')
    .neq('target_scope', 'radius')
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso)
    .ilike('item_name', `%${term}%`)
    .order('created_at', { ascending: false })
    .limit(10);
  dbQuery = city ? dbQuery.or(`target_city.is.null,target_city.eq.${city}`) : dbQuery.is('target_city', null);
  if (opts.kinds?.length) dbQuery = dbQuery.in('kind', opts.kinds);

  const { data, error } = await dbQuery;
  if (error) throw error;
  let ads = (data ?? []) as unknown as AdWithBusiness[];

  if (coords) {
    const radiusAds = await getEligibleRadiusAds(coords, nowIso, { itemNameIlike: term, kinds: opts.kinds });
    ads = [...ads, ...radiusAds].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  if (opts.businessTypeIn?.length) {
    ads = ads.filter((ad) => ad.business?.business_type && opts.businessTypeIn!.includes(ad.business.business_type));
  }
  return ads.length > 0 ? adToFeedCatalogItem(ads[0]) : null;
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
