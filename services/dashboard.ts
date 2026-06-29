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
  const [helpRequestsResult, appointmentsResult, productsResult, servicesResult, adsResult, storiesResult] =
    await Promise.all([
      supabase.from('help_requests').select('status').eq('accepted_business_id', businessId),
      supabase.from('appointments').select('status').eq('business_id', businessId),
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

  if (helpRequestsResult.error) throw helpRequestsResult.error;
  if (appointmentsResult.error) throw appointmentsResult.error;
  if (productsResult.error) throw productsResult.error;
  if (servicesResult.error) throw servicesResult.error;
  if (adsResult.error) throw adsResult.error;
  if (storiesResult.error) throw storiesResult.error;

  const helpRequests = helpRequestsResult.data ?? [];
  const appointments = appointmentsResult.data ?? [];
  const appointmentsCompleted = appointments.filter((a) => a.status === 'completed').length;

  return {
    helpRequestsTotal: helpRequests.length,
    helpRequestsCompleted: helpRequests.filter((r) => r.status === 'completed').length,
    appointmentsTotal: appointments.length,
    appointmentsCompleted,
    appointmentsConversionRate: appointments.length > 0 ? appointmentsCompleted / appointments.length : null,
    topProducts: (productsResult.data ?? []) as CatalogItemStat[],
    topServices: (servicesResult.data ?? []) as CatalogItemStat[],
    adImpressions: (adsResult.data ?? []).reduce((sum, a) => sum + a.impressions, 0),
    adClicks: (adsResult.data ?? []).reduce((sum, a) => sum + a.clicks, 0),
    storyViews: (storiesResult.data ?? []).reduce((sum, s) => sum + s.views, 0),
    storyClicks: (storiesResult.data ?? []).reduce((sum, s) => sum + s.clicks, 0),
  };
}
