import { supabase } from './supabase';
import { distanceKm } from '../utils/distance';
import type { Business, BusinessSchedule, BusinessType, SubscriptionPlan } from '../types/database';

export interface BusinessWithDistance extends Business {
  distance_km: number | null;
}

const SEARCH_RADIUS_KM = 60;

// A quien le vende cada tipo de negocio, segun el flujo B2B de SOSmoto:
// taller le compra a tienda y marca; tienda le compra solo a marca (nunca a
// otro taller ni a otra tienda -- ninguno tiene caso de uso B2B ahi). Marca
// no compra a nadie -- no aparece como clave aca a proposito. Fuente unica
// de esta regla: la usan el buscador B2B (buscar.tsx), el boton de compra en
// producto/[id].tsx, y la visibilidad de "Mis compras" en configuracion.tsx.
export const B2B_ALLOWED_SELLER_TYPES: Partial<Record<BusinessType, BusinessType[]>> = {
  workshop: ['store', 'brand_advertiser'],
  store: ['brand_advertiser'],
};

export function canBuyFromBusinessType(
  viewerType: BusinessType | null | undefined,
  sellerType: BusinessType | null | undefined
): boolean {
  if (!viewerType || !sellerType) return false;
  return B2B_ALLOWED_SELLER_TYPES[viewerType]?.includes(sellerType) ?? false;
}

export async function getNearbyBusinesses(
  coords: { latitude: number; longitude: number } | null,
  limit = 20
): Promise<BusinessWithDistance[]> {
  let query = supabase.from('businesses').select('*');

  if (coords) {
    const latDelta = SEARCH_RADIUS_KM / 111;
    const lngDelta = SEARCH_RADIUS_KM / (111 * Math.cos((coords.latitude * Math.PI) / 180));
    query = query
      .gte('latitude', coords.latitude - latDelta)
      .lte('latitude', coords.latitude + latDelta)
      .gte('longitude', coords.longitude - lngDelta)
      .lte('longitude', coords.longitude + lngDelta);
  }

  const { data, error } = await query.limit(200);
  if (error) throw error;

  const businesses = (data ?? []) as Business[];

  const withDistance: BusinessWithDistance[] = businesses.map((business) => ({
    ...business,
    distance_km: coords
      ? distanceKm(coords.latitude, coords.longitude, business.latitude, business.longitude)
      : null,
  }));

  withDistance.sort((a, b) => {
    if (a.distance_km === null || b.distance_km === null) return 0;
    return a.distance_km - b.distance_km;
  });

  return withDistance.slice(0, limit);
}

// Proxy de "ciudad del cliente": no hay GPS->ciudad ni preferencia guardada
// todavía, así que se usa la ciudad del negocio más cercano por coordenadas.
export async function getNearestCity(
  coords: { latitude: number; longitude: number } | null
): Promise<string | null> {
  if (!coords) return null;
  const nearby = await getNearbyBusinesses(coords, 1);
  return nearby[0]?.city ?? null;
}

export async function getFollowedBusinesses(clientId: string): Promise<Business[]> {
  const { data: follows, error: followsError } = await supabase
    .from('follows')
    .select('business_id')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (followsError) throw followsError;

  const businessIds = (follows ?? []).map((f) => f.business_id);
  if (businessIds.length === 0) return [];

  const { data, error } = await supabase.from('businesses').select('*').in('id', businessIds);
  if (error) throw error;

  return (data ?? []) as Business[];
}

export interface SearchBusinessesParams {
  query?: string;
  businessType?: BusinessType;
  // Alternativa a businessType para filtrar por varios tipos a la vez (ej.
  // el buscador del taller: tiendas + marcas, nunca otros talleres).
  businessTypeIn?: BusinessType[];
  serviceName?: string;
  coords?: { latitude: number; longitude: number } | null;
  minRating?: number;
  only24h?: boolean;
}

export async function searchBusinesses(params: SearchBusinessesParams): Promise<BusinessWithDistance[]> {
  let serviceBusinessIds: string[] | null = null;

  if (params.serviceName) {
    const { data, error } = await supabase
      .from('services')
      .select('business_id')
      .eq('is_active', true)
      .ilike('name', `%${params.serviceName}%`);
    if (error) throw error;

    serviceBusinessIds = Array.from(new Set((data ?? []).map((s) => s.business_id)));
    if (serviceBusinessIds.length === 0) return [];
  }

  let query = supabase.from('businesses').select('*').eq('is_deactivated', false);
  if (serviceBusinessIds) query = query.in('id', serviceBusinessIds);
  if (params.businessType) query = query.eq('business_type', params.businessType);
  else if (params.businessTypeIn?.length) query = query.in('business_type', params.businessTypeIn);
  if (params.minRating) query = query.gte('rating_avg', params.minRating);
  if (params.only24h) query = query.eq('is_24h', true);
  if (params.query) {
    const term = params.query.trim();
    query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%`);
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;

  const businesses = (data ?? []) as Business[];
  const withDistance: BusinessWithDistance[] = businesses.map((business) => ({
    ...business,
    // Una marca se registra sin ubicación real (coordenadas de relleno,
    // QUITO_DEFAULT) -- calcularle una distancia real es inventada y engaña
    // (ver getNewNearbyBusinesses, que ya la excluye por el mismo motivo).
    distance_km:
      params.coords && business.business_type !== 'brand_advertiser'
        ? distanceKm(params.coords.latitude, params.coords.longitude, business.latitude, business.longitude)
        : null,
  }));

  withDistance.sort((a, b) => {
    if (a.distance_km === null || b.distance_km === null) return 0;
    return a.distance_km - b.distance_km;
  });

  return withDistance;
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const { data, error } = await supabase.from('businesses').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Business | null;
}

export async function getBusinessesByIds(ids: string[]): Promise<Business[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('businesses').select('*').in('id', ids);
  if (error) throw error;
  return (data ?? []) as Business[];
}

export async function getMyBusiness(ownerId: string): Promise<Business | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) throw error;
  return data as Business | null;
}

export interface MyWorkBusiness {
  business: Business;
  isOwner: boolean;
}

export async function getMyWorkBusiness(userId: string): Promise<MyWorkBusiness | null> {
  const owned = await getMyBusiness(userId);
  if (owned) return { business: owned, isOwner: true };

  const { data, error } = await supabase
    .from('business_employees')
    .select('businesses(*)')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  const business = (data as any)?.businesses ?? null;
  return business ? { business: business as Business, isOwner: false } : null;
}

export interface CreateBusinessParams {
  ownerId: string;
  businessType: BusinessType;
  name: string;
  address: string;
  city: string;
  province?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  whatsapp?: string;
}

// Radio de auxilio (km) asignado por defecto a un taller nuevo -- editable
// desde el admin (Configuración > Reglas del sistema, tabla system_settings).
export async function getDefaultAidRadiusKm(): Promise<number> {
  const { data } = await supabase
    .from('system_settings')
    .select('default_aid_radius_km')
    .eq('id', true)
    .maybeSingle();
  return data?.default_aid_radius_km ?? 5;
}

export async function createBusiness(params: CreateBusinessParams): Promise<Business> {
  const [{ data: plan, error: planError }, defaultAidRadiusKm] = await Promise.all([
    supabase.from('subscription_plans').select('id').eq('name', 'free').single(),
    getDefaultAidRadiusKm(),
  ]);
  if (planError) throw planError;

  const { data, error } = await supabase
    .from('businesses')
    .insert({
      owner_id: params.ownerId,
      business_type: params.businessType,
      name: params.name,
      address: params.address,
      city: params.city,
      province: params.province ?? null,
      latitude: params.latitude,
      longitude: params.longitude,
      phone: params.phone ?? null,
      whatsapp: params.whatsapp ?? null,
      plan_id: plan.id,
      aid_radius_km: params.businessType === 'workshop' ? defaultAidRadiusKm : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Business;
}

export interface UpdateBusinessParams {
  name?: string;
  description?: string | null;
  address?: string;
  city?: string;
  province?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  latitude?: number;
  longitude?: number;
  schedule?: BusinessSchedule | null;
  aid_radius_km?: number | null;
  is_24h?: boolean;
  logo_url?: string;
}

export async function updateBusiness(id: string, updates: UpdateBusinessParams): Promise<Business> {
  const { data, error } = await supabase.from('businesses').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Business;
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('price_monthly', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SubscriptionPlan[];
}

export async function setBusinessAvailability(businessId: string, available: boolean): Promise<void> {
  const { error } = await supabase
    .from('businesses')
    .update({ is_available_for_aid: available })
    .eq('id', businessId);
  if (error) throw error;
}

// "Desactivar negocio temporalmente" (Configuración > General) -- oculta el
// perfil de búsquedas y del matching de auxilio sin borrar nada; reactivar
// deja todo (catálogo, historial, seguidores) exactamente como estaba.
export async function setBusinessDeactivated(businessId: string, deactivated: boolean): Promise<void> {
  const { error } = await supabase
    .from('businesses')
    .update({ is_deactivated: deactivated })
    .eq('id', businessId);
  if (error) throw error;
}

export async function updateBusinessPlan(businessId: string, planId: string): Promise<Business> {
  const { data, error } = await supabase
    .from('businesses')
    .update({ plan_id: planId })
    .eq('id', businessId)
    .select()
    .single();
  if (error) throw error;
  return data as Business;
}

export async function getNewNearbyBusinesses(
  coords: { latitude: number; longitude: number } | null,
  limit = 6,
  options?: { onlyType?: BusinessType; excludeBusinessId?: string }
): Promise<BusinessWithDistance[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let query = supabase
    .from('businesses')
    .select('*')
    .eq('is_deactivated', false)
    .neq('business_type', 'brand_advertiser')
    .or(`created_at.gte.${thirtyDaysAgo.toISOString()},followers_count.lt.5`)
    .limit(30);

  if (options?.onlyType) query = query.eq('business_type', options.onlyType);
  if (options?.excludeBusinessId) query = query.neq('id', options.excludeBusinessId);

  const { data, error } = await query;

  if (error) throw error;

  const businesses = (data ?? []) as Business[];
  const withDistance: BusinessWithDistance[] = businesses.map((b) => ({
    ...b,
    distance_km: coords
      ? distanceKm(coords.latitude, coords.longitude, b.latitude, b.longitude)
      : null,
  }));

  withDistance.sort((a, b) => {
    if (a.distance_km === null && b.distance_km === null) return 0;
    if (a.distance_km === null) return 1;
    if (b.distance_km === null) return -1;
    return a.distance_km - b.distance_km;
  });

  return withDistance.slice(0, limit);
}
