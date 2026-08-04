import { supabase } from './supabase';
import { getProductIntentStats } from './productIntents';
import { getServiceAppointmentStats } from './appointments';

export type DashboardPeriod = 'week' | 'month' | 'all' | 'custom';

export interface CustomRange {
  from: Date;
  to: Date;
}

export interface CatalogItemStat {
  id: string;
  name: string;
  views: number;
  reservations: number;
  // "Vendidos" en productos, "Completadas" en servicios -- mismo campo,
  // la pantalla decide la etiqueta según la sección.
  completed: number;
}

export interface ChartPoint {
  label: string;
  values: Record<string, number>;
}

export interface PeakTime {
  dayLabel: string;
  hourLabel: string;
}

// Todo lo que NO depende del selector de período -- ranking de más
// vistos (con su reserva/venta acumulada), totales de anuncios/historias
// de siempre, y la conversión histórica de catálogo. Se pide una sola vez
// por visita a la pantalla (no en cada cambio de Semana/Mes/Todo/Rango),
// que antes eran ~16 consultas + hasta 10 más encadenadas repitiéndose
// sin necesidad en cada cambio de período -- eso era la demora real.
export interface CatalogSnapshot {
  topProducts: CatalogItemStat[];
  topServices: CatalogItemStat[];
  adImpressions: number;
  adClicks: number;
  storyViews: number;
  storyClicks: number;
  catalogConversionRate: number | null;
}

// Todo lo que SÍ depende del período elegido -- esto es lo único que se
// vuelve a pedir al cambiar de Semana/Mes/Todo/Rango.
export interface PeriodStats {
  period: DashboardPeriod;
  rangeFrom: string | null;
  rangeTo: string | null;

  helpRequestsTotal: number;
  helpRequestsCompleted: number;
  helpRequestsPrevTotal: number | null;
  appointmentsTotal: number;
  appointmentsCompleted: number;
  appointmentsPrevTotal: number | null;
  appointmentsConversionRate: number | null;
  avgResponseMinutes: number | null;
  avgResponseMinutesPrev: number | null;
  ratingAvg: number | null;
  ratingAvgPrev: number | null;
  ratingCount: number;
  trend: ChartPoint[];
  peakHelpRequestTime: PeakTime | null;
  peakAppointmentTime: PeakTime | null;

  productViewsTotal: number;
  productViewsPrevTotal: number | null;
  serviceViewsTotal: number;
  serviceViewsPrevTotal: number | null;
  catalogTrend: ChartPoint[];

  adImpressionsPrevTotal: number | null;
  adClicksPrevTotal: number | null;
  storyClicksPrevTotal: number | null;

  followersGained: number;
  followersGainedPrevTotal: number | null;
  followersTrend: ChartPoint[];
}

export type BusinessDashboardStats = CatalogSnapshot & PeriodStats;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
// Umbral mínimo de eventos para no mostrar un "pico" que en realidad es
// ruido de 1-2 solicitudes sueltas.
const MIN_EVENTS_FOR_PEAK = 5;

interface PeriodRange {
  since: Date;
  until: Date;
  prevSince: Date;
  prevUntil: Date;
}

// 'all' no tiene un periodo anterior con el que comparar -- ahí
// comparaciones/tendencia quedan vacías, solo se muestran los totales de
// siempre (mismo comportamiento que antes de agregar el selector).
function getPeriodRange(period: DashboardPeriod, customRange?: CustomRange): PeriodRange | null {
  if (period === 'all') return null;
  if (period === 'custom' && customRange) {
    const since = customRange.from;
    const until = customRange.to;
    const span = until.getTime() - since.getTime();
    return { since, until, prevSince: new Date(since.getTime() - span), prevUntil: since };
  }
  const days = period === 'week' ? 7 : 30;
  const until = new Date();
  const since = new Date(until.getTime() - days * MS_PER_DAY);
  return { since, until, prevSince: new Date(since.getTime() - days * MS_PER_DAY), prevUntil: since };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

interface Bucket {
  label: string;
  start: number;
  end: number;
}

// Dia si el rango cabe en ~9 dias, semana si cabe en ~70, si no mes -- asi
// nunca se dibujan decenas de barras apretadas en una pantalla de celular.
function buildBuckets(since: Date, until: Date): Bucket[] {
  const spanDays = (until.getTime() - since.getTime()) / MS_PER_DAY;
  const buckets: Bucket[] = [];
  if (spanDays <= 9) {
    let cursor = new Date(since);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() < until.getTime()) {
      const start = cursor.getTime();
      const end = start + MS_PER_DAY;
      buckets.push({ label: WEEKDAY_SHORT[cursor.getDay()], start, end });
      cursor = new Date(end);
    }
  } else if (spanDays <= 70) {
    let i = 1;
    let cursor = since.getTime();
    while (cursor < until.getTime()) {
      const end = Math.min(cursor + MS_PER_DAY * 7, until.getTime());
      buckets.push({ label: `Sem ${i}`, start: cursor, end });
      cursor = end;
      i++;
    }
  } else {
    const cursor = new Date(since.getFullYear(), since.getMonth(), 1);
    while (cursor.getTime() < until.getTime()) {
      const start = cursor.getTime();
      const label = cursor.toLocaleDateString('es-EC', { month: 'short' });
      cursor.setMonth(cursor.getMonth() + 1);
      buckets.push({ label, start, end: cursor.getTime() });
    }
  }
  return buckets;
}

function bucketCounts(dates: string[], buckets: Bucket[]): number[] {
  const counts = new Array(buckets.length).fill(0);
  dates.forEach((iso) => {
    const t = new Date(iso).getTime();
    let idx = buckets.findIndex((b) => t >= b.start && t < b.end);
    if (idx === -1 && buckets.length > 0 && t >= buckets[buckets.length - 1].end) idx = buckets.length - 1;
    if (idx !== -1) counts[idx] += 1;
  });
  return counts;
}

function buildChartPoints(buckets: Bucket[], series: Record<string, string[]>): ChartPoint[] {
  const seriesCounts: Record<string, number[]> = {};
  for (const key of Object.keys(series)) {
    seriesCounts[key] = bucketCounts(series[key], buckets);
  }
  return buckets.map((b, i) => ({
    label: b.label,
    values: Object.fromEntries(Object.keys(series).map((key) => [key, seriesCounts[key][i]])),
  }));
}

function computePeakTime(dates: string[]): PeakTime | null {
  if (dates.length < MIN_EVENTS_FOR_PEAK) return null;
  const dayCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);
  dates.forEach((iso) => {
    const d = new Date(iso);
    dayCounts[d.getDay()] += 1;
    hourCounts[d.getHours()] += 1;
  });
  const peakDay = dayCounts.indexOf(Math.max(...dayCounts));
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  return {
    dayLabel: WEEKDAY_FULL[peakDay],
    hourLabel: `${String(peakHour).padStart(2, '0')}:00–${String((peakHour + 1) % 24).padStart(2, '0')}:00`,
  };
}

export async function getBusinessCatalogSnapshot(businessId: string): Promise<CatalogSnapshot> {
  const [productsResult, allProductViewsResult, productIntentsResult, servicesResult, adsResult, storiesResult] =
    await Promise.all([
      supabase.from('products').select('id, name, views').eq('business_id', businessId).order('views', { ascending: false }).limit(5),
      supabase.from('products').select('views').eq('business_id', businessId),
      supabase.from('product_intents').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      supabase.from('services').select('id, name, views').eq('business_id', businessId).order('views', { ascending: false }).limit(5),
      // impressions/clicks ya no son legibles por select directo (columnas
      // revocadas para authenticated/anon, ver migración 0142 -- cualquier
      // negocio podía leer las métricas de campañas ajenas) -- se agregan
      // server-side vía una función security definer que sí valida dueño/admin.
      supabase.rpc('get_business_ad_metrics', { target_business_id: businessId }),
      supabase.from('stories').select('views, clicks').eq('business_id', businessId),
    ]);

  if (productsResult.error) throw productsResult.error;
  if (allProductViewsResult.error) throw allProductViewsResult.error;
  if (productIntentsResult.error) throw productIntentsResult.error;
  if (servicesResult.error) throw servicesResult.error;
  if (adsResult.error) throw adsResult.error;
  if (storiesResult.error) throw storiesResult.error;

  // Reservas/vendidos y citas/completadas por item -- solo para el top 5 que
  // ya se muestra (no vale la pena traerlo para todo el catálogo), una
  // consulta chica por item en paralelo.
  const [topProducts, topServices] = await Promise.all([
    Promise.all(
      (productsResult.data ?? []).map(async (p) => {
        const s = await getProductIntentStats(p.id);
        return { id: p.id, name: p.name, views: p.views, reservations: s.reservations, completed: s.sold };
      })
    ),
    Promise.all(
      (servicesResult.data ?? []).map(async (s) => {
        const stat = await getServiceAppointmentStats(s.id);
        return { id: s.id, name: s.name, views: s.views, reservations: stat.reservations, completed: stat.completed };
      })
    ),
  ]);

  const adMetrics = adsResult.data?.[0] ?? { total_impressions: 0, total_clicks: 0 };
  const totalProductViews = (allProductViewsResult.data ?? []).reduce((sum, p) => sum + (p.views ?? 0), 0);
  const totalIntents = productIntentsResult.count ?? 0;

  return {
    topProducts,
    topServices,
    adImpressions: adMetrics.total_impressions,
    adClicks: adMetrics.total_clicks,
    // Vistas de historias solo alcanza el total de siempre -- las historias
    // se borran a las 24h (si no están fijadas) y arrastran sus vistas en
    // cascada, así que un total "de la semana/mes" quedaría incompleto y
    // engañoso.
    storyViews: (storiesResult.data ?? []).reduce((sum, s) => sum + s.views, 0),
    storyClicks: (storiesResult.data ?? []).reduce((sum, s) => sum + s.clicks, 0),
    catalogConversionRate: totalProductViews > 0 ? totalIntents / totalProductViews : null,
  };
}

export async function getBusinessPeriodStats(
  businessId: string,
  period: DashboardPeriod = 'week',
  customRange?: CustomRange
): Promise<PeriodStats> {
  const range = getPeriodRange(period, customRange);

  let helpRequestsQuery = supabase.from('help_requests').select('created_at, status, accepted_at').eq('accepted_business_id', businessId);
  let appointmentsQuery = supabase.from('appointments').select('created_at, status').eq('business_id', businessId);
  let reviewsQuery = supabase.from('reviews').select('rating, created_at').eq('reviewed_business_id', businessId).eq('is_public', true);
  // Sin rango (periodo "Todo"), followersGained/followersTrend nunca se
  // muestran (ver abajo) -- pedir follows completo ahí era puro
  // desperdicio, más notorio mientras más crece la tabla. product_view/
  // service_view sí se usan siempre (vistas totales de catálogo), pero
  // ad_impression/ad_click/story_click solo alimentan comparaciones que
  // en "Todo" son null -- se acotan los metric para no traer filas que
  // nunca se usan.
  let eventsQuery = range
    ? supabase.from('business_metric_events').select('metric, created_at').eq('business_id', businessId)
    : supabase.from('business_metric_events').select('metric').eq('business_id', businessId).in('metric', ['product_view', 'service_view']);
  let followsQuery = range ? supabase.from('follows').select('created_at').eq('business_id', businessId) : null;
  if (range) {
    helpRequestsQuery = helpRequestsQuery.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());
    appointmentsQuery = appointmentsQuery.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());
    reviewsQuery = reviewsQuery.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());
    eventsQuery = eventsQuery.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());
    followsQuery = followsQuery!.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());
  }

  const [
    helpRequestsResult,
    appointmentsResult,
    reviewsResult,
    eventsResult,
    followsResult,
    prevHelpRequestsResult,
    prevAppointmentsResult,
    prevReviewsResult,
    prevEventsResult,
    prevFollowsResult,
  ] = await Promise.all([
    helpRequestsQuery,
    appointmentsQuery,
    reviewsQuery,
    eventsQuery,
    followsQuery ?? Promise.resolve({ data: null, error: null }),
    range
      ? supabase
          .from('help_requests')
          .select('created_at, accepted_at')
          .eq('accepted_business_id', businessId)
          .gte('created_at', range.prevSince.toISOString())
          .lt('created_at', range.prevUntil.toISOString())
      : Promise.resolve({ data: null, error: null }),
    range
      ? supabase
          .from('appointments')
          .select('status')
          .eq('business_id', businessId)
          .gte('created_at', range.prevSince.toISOString())
          .lt('created_at', range.prevUntil.toISOString())
      : Promise.resolve({ data: null, error: null }),
    range
      ? supabase
          .from('reviews')
          .select('rating')
          .eq('reviewed_business_id', businessId)
          .eq('is_public', true)
          .gte('created_at', range.prevSince.toISOString())
          .lt('created_at', range.prevUntil.toISOString())
      : Promise.resolve({ data: null, error: null }),
    range
      ? supabase
          .from('business_metric_events')
          .select('metric')
          .eq('business_id', businessId)
          .gte('created_at', range.prevSince.toISOString())
          .lt('created_at', range.prevUntil.toISOString())
      : Promise.resolve({ data: null, error: null }),
    range
      ? supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .gte('created_at', range.prevSince.toISOString())
          .lt('created_at', range.prevUntil.toISOString())
      : Promise.resolve({ count: null, error: null }),
  ]);

  if (helpRequestsResult.error) throw helpRequestsResult.error;
  if (appointmentsResult.error) throw appointmentsResult.error;
  if (reviewsResult.error) throw reviewsResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (followsResult.error) throw followsResult.error;
  if (prevHelpRequestsResult.error) throw prevHelpRequestsResult.error;
  if (prevAppointmentsResult.error) throw prevAppointmentsResult.error;
  if (prevReviewsResult.error) throw prevReviewsResult.error;
  if (prevEventsResult.error) throw prevEventsResult.error;
  if (prevFollowsResult.error) throw prevFollowsResult.error;

  const helpRequests = helpRequestsResult.data ?? [];
  const appointments = appointmentsResult.data ?? [];
  const reviews = reviewsResult.data ?? [];
  const events = (eventsResult.data ?? []) as { metric: string; created_at: string }[];
  const prevEvents = (prevEventsResult.data ?? []) as { metric: string }[];

  const helpRequestsTotal = helpRequests.length;
  const helpRequestsCompleted = helpRequests.filter((h) => h.status === 'completed').length;
  const appointmentsTotal = appointments.length;
  const appointmentsCompletedCount = appointments.filter((a) => a.status === 'completed').length;

  const responseMinutes = helpRequests
    .filter((h) => h.accepted_at)
    .map((h) => (new Date(h.accepted_at as string).getTime() - new Date(h.created_at).getTime()) / 60000);
  const prevResponseMinutes = range
    ? (prevHelpRequestsResult.data ?? [])
        .filter((h: { accepted_at: string | null }) => h.accepted_at)
        .map(
          (h: { created_at: string; accepted_at: string | null }) =>
            (new Date(h.accepted_at as string).getTime() - new Date(h.created_at).getTime()) / 60000
        )
    : [];

  const byMetric = (metric: string) => events.filter((e) => e.metric === metric);
  const prevByMetricCount = (metric: string) => prevEvents.filter((e) => e.metric === metric).length;

  let trend: ChartPoint[] = [];
  let catalogTrend: ChartPoint[] = [];
  let followersTrend: ChartPoint[] = [];
  let peakHelpRequestTime: PeakTime | null = null;
  let peakAppointmentTime: PeakTime | null = null;

  if (range) {
    const buckets = buildBuckets(range.since, range.until);
    trend = buildChartPoints(buckets, {
      helpRequests: helpRequests.map((h) => h.created_at),
      appointments: appointments.map((a) => a.created_at),
    });
    catalogTrend = buildChartPoints(buckets, {
      productViews: byMetric('product_view').map((e) => e.created_at),
      serviceViews: byMetric('service_view').map((e) => e.created_at),
    });
    followersTrend = buildChartPoints(buckets, {
      followers: (followsResult.data ?? []).map((f: { created_at: string }) => f.created_at),
    });
    peakHelpRequestTime = computePeakTime(helpRequests.map((h) => h.created_at));
    peakAppointmentTime = computePeakTime(appointments.map((a) => a.created_at));
  }

  return {
    period,
    rangeFrom: range ? range.since.toISOString() : null,
    rangeTo: range ? range.until.toISOString() : null,

    helpRequestsTotal,
    helpRequestsCompleted,
    helpRequestsPrevTotal: range ? (prevHelpRequestsResult.data ?? []).length : null,
    appointmentsTotal,
    appointmentsCompleted: appointmentsCompletedCount,
    appointmentsPrevTotal: range ? (prevAppointmentsResult.data ?? []).length : null,
    appointmentsConversionRate: appointmentsTotal > 0 ? appointmentsCompletedCount / appointmentsTotal : null,
    avgResponseMinutes: average(responseMinutes),
    avgResponseMinutesPrev: range ? average(prevResponseMinutes) : null,
    ratingAvg: average(reviews.map((r) => r.rating)),
    ratingAvgPrev: range ? average((prevReviewsResult.data ?? []).map((r: { rating: number }) => r.rating)) : null,
    ratingCount: reviews.length,
    trend,
    peakHelpRequestTime,
    peakAppointmentTime,

    productViewsTotal: byMetric('product_view').length,
    productViewsPrevTotal: range ? prevByMetricCount('product_view') : null,
    serviceViewsTotal: byMetric('service_view').length,
    serviceViewsPrevTotal: range ? prevByMetricCount('service_view') : null,
    catalogTrend,

    adImpressionsPrevTotal: range ? prevByMetricCount('ad_impression') : null,
    adClicksPrevTotal: range ? prevByMetricCount('ad_click') : null,
    storyClicksPrevTotal: range ? prevByMetricCount('story_click') : null,

    followersGained: range ? (followsResult.data ?? []).length : 0,
    followersGainedPrevTotal: range ? (prevFollowsResult.count ?? 0) : null,
    followersTrend,
  };
}
