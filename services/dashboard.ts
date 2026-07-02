import { supabase } from './supabase';

export interface CatalogItemStat {
  id: string;
  name: string;
  views: number;
}

export interface BusinessDashboardStats {
  helpRequestsTotal: number;
  helpRequestsCompleted: number;
  appointmentsTotal: number;
  appointmentsCompleted: number;
  appointmentsConversionRate: number | null;
  topProducts: CatalogItemStat[];
  topServices: CatalogItemStat[];
  adImpressions: number;
  adClicks: number;
  storyViews: number;
  storyClicks: number;
}

export async function getBusinessDashboardStats(businessId: string): Promise<BusinessDashboardStats> {
  const [hrTotal, hrCompleted, apptTotal, apptCompleted, productsResult, servicesResult, adsResult, storiesResult] =
    await Promise.all([
      supabase
        .from('help_requests')
        .select('*', { count: 'exact', head: true })
        .eq('accepted_business_id', businessId),
      supabase
        .from('help_requests')
        .select('*', { count: 'exact', head: true })
        .eq('accepted_business_id', businessId)
        .eq('status', 'completed'),
      supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId),
      supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', 'completed'),
      supabase
        .from('products')
        .select('id, name, views')
        .eq('business_id', businessId)
        .order('views', { ascending: false })
        .limit(5),
      supabase
        .from('services')
        .select('id, name, views')
        .eq('business_id', businessId)
        .order('views', { ascending: false })
        .limit(5),
      supabase.from('ads').select('impressions, clicks').eq('business_id', businessId),
      supabase.from('stories').select('views, clicks').eq('business_id', businessId),
    ]);

  if (hrTotal.error) throw hrTotal.error;
  if (hrCompleted.error) throw hrCompleted.error;
  if (apptTotal.error) throw apptTotal.error;
  if (apptCompleted.error) throw apptCompleted.error;
  if (productsResult.error) throw productsResult.error;
  if (servicesResult.error) throw servicesResult.error;
  if (adsResult.error) throw adsResult.error;
  if (storiesResult.error) throw storiesResult.error;

  const helpRequestsTotal = hrTotal.count ?? 0;
  const helpRequestsCompleted = hrCompleted.count ?? 0;
  const appointmentsTotal = apptTotal.count ?? 0;
  const appointmentsCompletedCount = apptCompleted.count ?? 0;

  return {
    helpRequestsTotal,
    helpRequestsCompleted,
    appointmentsTotal,
    appointmentsCompleted: appointmentsCompletedCount,
    appointmentsConversionRate: appointmentsTotal > 0 ? appointmentsCompletedCount / appointmentsTotal : null,
    topProducts: (productsResult.data ?? []) as CatalogItemStat[],
    topServices: (servicesResult.data ?? []) as CatalogItemStat[],
    adImpressions: (adsResult.data ?? []).reduce((sum, a) => sum + a.impressions, 0),
    adClicks: (adsResult.data ?? []).reduce((sum, a) => sum + a.clicks, 0),
    storyViews: (storiesResult.data ?? []).reduce((sum, s) => sum + s.views, 0),
    storyClicks: (storiesResult.data ?? []).reduce((sum, s) => sum + s.clicks, 0),
  };
}
