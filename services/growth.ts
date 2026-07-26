import { ADS_ENABLED } from '../constants/features';
import { supabase } from './supabase';
import type { GrowthSuggestion } from '../types/database';

export async function getActiveGrowthSuggestion(businessId: string): Promise<GrowthSuggestion | null> {
  let query = supabase
    .from('growth_suggestions')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'active');
  // Publicidad está desactivada para el lanzamiento (ver constants/features.ts)
  // -- no tiene sentido sugerirle a un negocio que se anuncie si la pantalla
  // ni siquiera está disponible. check-business-growth ya dejó de generar
  // estas dos, pero esto también filtra cualquier sugerencia vieja que haya
  // quedado activa de antes de desactivar el flag.
  if (!ADS_ENABLED) {
    query = query.not('type', 'in', '(advertise_new_business,advertise_low_visibility)');
  }
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as GrowthSuggestion | null;
}

export async function dismissGrowthSuggestion(id: string): Promise<void> {
  const { error } = await supabase.from('growth_suggestions').update({ status: 'dismissed' }).eq('id', id);
  if (error) throw error;
}
