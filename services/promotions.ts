import { supabase } from './supabase';
import type { ActivePlanPromotion, Business, BusinessSubscription } from '../types/database';

export async function getActivePlanPromotion(): Promise<ActivePlanPromotion | null> {
  const { data, error } = await supabase.rpc('get_active_plan_promotion');
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row) return null;
  return {
    id: row.id,
    plan_id: row.plan_id,
    plan_name: row.plan_name,
    duration_days: row.duration_days,
    activated_at: row.activated_at,
    applies_to_all_businesses: row.applies_to_all_businesses,
  };
}

// Un negocio es elegible si: nunca reclamó una promoción antes, y (a menos
// que el admin haya activado "Todos" en vez de "Nuevos negocios") se
// registró después de que la promoción actual se activó.
export function isEligibleForPromotion(business: Business, promotion: ActivePlanPromotion): boolean {
  if (business.promotion_claimed_at) return false;
  if (promotion.applies_to_all_businesses) return true;
  return new Date(business.created_at) >= new Date(promotion.activated_at);
}

export async function claimPlanPromotion(businessId: string): Promise<BusinessSubscription> {
  const { data, error } = await supabase.rpc('claim_plan_promotion', { target_business_id: businessId });
  if (error) throw error;
  return data as BusinessSubscription;
}
