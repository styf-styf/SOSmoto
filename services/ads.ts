import { supabase } from './supabase';
import { distanceKm } from '../utils/distance';
import type { FeedCatalogItem } from './catalog';
import type { Ad, AdKind, AdPricing, AdTargetScope, BusinessType } from '../types/database';

type Coords = { latitude: number; longitude: number };

export interface AdWithBusiness extends Ad {
  business: {
    name: string;
    logo_url: string | null;
    is_verified: boolean;
    business_type?: BusinessType;
    owner_id?: string;
  } | null;
}

// Incluye owner_id del negocio para poder abrir un chat directo desde
// AdDetail cuando el anuncio no está vinculado a ningún producto/servicio
// real (ver handleChat en AdDetail.tsx). El anuncio ya no tiene comentarios
// propios (ver ad_comments -- la tabla se deja intacta, solo se dejó de leer/
// escribir desde la app, era una interacción huérfana que no aportaba a la
// conversión real del anuncio).
export async function getAdById(adId: string): Promise<AdWithBusiness | null> {
  const { data, error } = await supabase
    .from('ads')
    .select('*, business:businesses(name, logo_url, is_verified, owner_id)')
    .eq('id', adId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as AdWithBusiness | null;
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
  // Obligatorio del lado de la app cuando linkUrl está presente (ver
  // publicidad.tsx) -- texto del botón, ej. "WhatsApp", "Sitio web".
  linkLabel?: string;
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
      linkLabel: params.linkLabel,
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
    // Si el anuncio está vinculado a un producto/servicio ya publicado (no
    // uno creado solo para la campaña), este es su id real -- Home/Buscar lo
    // usan para ocultar la tarjeta orgánica de ese mismo ítem y que no se
    // vea duplicado (la tarjeta del anuncio ya lleva a esa misma ficha).
    linkedItemId: ad.product_id ?? ad.service_id ?? undefined,
  };
}

export interface LinkedCatalogId {
  kind: AdKind;
  id: string;
}

function getLinkedCatalogIds(ads: AdWithBusiness[]): LinkedCatalogId[] {
  return ads
    .filter((ad) => ad.product_id || ad.service_id)
    .map((ad) => ({ kind: ad.kind, id: (ad.product_id ?? ad.service_id)! }));
}

export interface HomeAdsResult {
  // Banner tipo publicación, mezclado entre posts (ver AdBanner.tsx en HomeFeed).
  bannerAds: AdWithBusiness[];
  // Tarjetas mezcladas en el carrusel de catálogo, con chip "Anuncio".
  carouselItems: FeedCatalogItem[];
  // Ids de producto/servicio con un anuncio activo vinculado -- para excluir
  // su tarjeta orgánica del pool de catálogo (ver getFeedCatalogPool).
  linkedCatalogIds: LinkedCatalogId[];
}

// Reparte los anuncios elegibles entre banner y carrusel SIN superposición:
// primero se sortea el cupo del carrusel, y el banner se arma con el resto
// -- así un mismo anuncio nunca aparece a la vez como banner grande Y como
// tarjeta del carrusel en la misma sesión de scroll (antes cada superficie
// pedía su propio sorteo/orden sobre el mismo pool completo, sin excluirse
// entre sí).
export async function getHomeAds(
  city: string | null,
  coords: Coords | null,
  opts: { excludeBrand?: boolean; bannerCount?: number; carouselCount?: number } = {}
): Promise<HomeAdsResult> {
  const ads = await getEligibleAds(city, coords);
  const filtered = opts.excludeBrand ? ads.filter((ad) => ad.business?.business_type !== 'brand_advertiser') : ads;

  const carouselAds = pickRandom(filtered, opts.carouselCount ?? 5);
  const carouselIds = new Set(carouselAds.map((ad) => ad.id));
  const bannerAds = filtered.filter((ad) => !carouselIds.has(ad.id)).slice(0, opts.bannerCount ?? 15);

  return {
    bannerAds,
    carouselItems: carouselAds.map(adToFeedCatalogItem),
    linkedCatalogIds: getLinkedCatalogIds(filtered),
  };
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

// Pausar deja de mostrar la campaña sin cancelarla para siempre -- guarda
// paused_at para que resumeAd() pueda correr ends_at hacia adelante lo que
// haya durado pausada, sin robarle días ya pagados al negocio.
export async function pauseAd(adId: string): Promise<Ad> {
  const { data, error } = await supabase
    .from('ads')
    .update({ status: 'paused', paused_at: new Date().toISOString() })
    .eq('id', adId)
    .select()
    .single();
  if (error) throw error;
  return data as Ad;
}

export async function resumeAd(adId: string): Promise<Ad> {
  const { data: current, error: fetchError } = await supabase
    .from('ads')
    .select('ends_at, paused_at')
    .eq('id', adId)
    .single();
  if (fetchError) throw fetchError;

  let endsAt = current.ends_at;
  if (current.paused_at) {
    const pausedMs = Math.max(0, Date.now() - new Date(current.paused_at).getTime());
    endsAt = new Date(new Date(current.ends_at).getTime() + pausedMs).toISOString();
  }

  const { data, error } = await supabase
    .from('ads')
    .update({ status: 'active', paused_at: null, ends_at: endsAt })
    .eq('id', adId)
    .select()
    .single();
  if (error) throw error;
  return data as Ad;
}
