import { supabase } from './supabase';
import type { Ad } from '../types/database';

export interface CreateAdParams {
  businessId: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  durationDays: number;
}

// Sin pasarela de pago todavía (igual que el cambio de plan de suscripción):
// la campaña queda activa de inmediato, sin cola de revisión de admin.
export async function createAd(params: CreateAdParams): Promise<Ad> {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + params.durationDays * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('ads')
    .insert({
      business_id: params.businessId,
      type: 'home_banner',
      title: params.title,
      image_url: params.imageUrl,
      link_url: params.linkUrl ?? null,
      status: 'active',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as Ad;
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
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('ads')
    .select('*')
    .eq('type', 'home_banner')
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
