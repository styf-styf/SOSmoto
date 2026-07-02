import { supabase } from './supabase';
import type { BusinessVerificationRequest } from '../types/database';

export async function getLatestVerificationRequest(businessId: string): Promise<BusinessVerificationRequest | null> {
  const { data, error } = await supabase
    .from('business_verification_requests')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as BusinessVerificationRequest | null;
}

export interface CreateVerificationRequestParams {
  businessId: string;
  idDocumentPath: string;
  rucDocumentPath?: string;
  storefrontPhotoPath: string;
  notes?: string;
}

export async function createVerificationRequest(
  params: CreateVerificationRequestParams
): Promise<BusinessVerificationRequest> {
  const { data, error } = await supabase
    .from('business_verification_requests')
    .insert({
      business_id: params.businessId,
      id_document_path: params.idDocumentPath,
      ruc_document_path: params.rucDocumentPath ?? null,
      storefront_photo_path: params.storefrontPhotoPath,
      notes: params.notes?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BusinessVerificationRequest;
}
