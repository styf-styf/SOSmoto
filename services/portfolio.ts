import { supabase } from './supabase';
import { pickImageFromLibrary, uploadBusinessImage } from './storage';
import type { PortfolioPhoto } from '../types/database';

export type { PortfolioPhoto };

export async function getPortfolioPhotos(businessId: string): Promise<PortfolioPhoto[]> {
  const { data, error } = await supabase
    .from('portfolio_photos')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PortfolioPhoto[];
}

export async function addPortfolioPhoto(
  businessId: string,
  caption?: string
): Promise<PortfolioPhoto | null> {
  const asset = await pickImageFromLibrary();
  if (!asset) return null;
  const imageUrl = await uploadBusinessImage(asset, businessId);
  const { data, error } = await supabase
    .from('portfolio_photos')
    .insert({ business_id: businessId, image_url: imageUrl, caption: caption ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as PortfolioPhoto;
}

export async function deletePortfolioPhoto(id: string): Promise<void> {
  const { error } = await supabase.from('portfolio_photos').delete().eq('id', id);
  if (error) throw error;
}
