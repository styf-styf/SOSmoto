import { createAdminClient } from '../../../lib/supabase/admin';
import { BarChart } from '../../../components/BarChart';
import {
  type Period,
  resolveRange,
  buildBuckets,
  buildCountChartPoints,
  buildSumChartPoints,
  average,
} from '../../../lib/metrics';
import type { BusinessType, PlanName } from '../../../lib/types';

const PERIOD_LABEL: Record<Period, string> = { week: 'Semana', month: 'Mes', all: 'Todo', custom: 'Rango' };
const BUSINESS_TYPE_LABEL: Record<string, string> = { workshop: 'Taller', store: 'Tienda', brand_advertiser: 'Marca (legado)' };
const HELP_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  in_progress: 'En camino',
  completed: 'Completada',
  cancelled: 'Cancelada',
};
const AD_STATUS_LABEL: Record<string, string> = {
  pending_review: 'Por revisar',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  active: 'Activo',
  expired: 'Expirado',
  paused: 'Pausado',
};
const SUB_STATUS_LABEL: Record<string, string> = { active: 'Activa', expired: 'Expirada', cancelled: 'Cancelada' };

interface BusinessSnapshotRow {
  business_type: BusinessType;
  is_verified: boolean;
  city: string;
  followers_count: number;
  subscription_plans: { name: PlanName; price_monthly: number } | null;
}

interface HelpRequestRow {
  status: string;
  created_at: string;
  accepted_at: string | null;
  businesses: { city: string } | null;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString('es-EC');
const fmtMoney = (n: number) => `$${n.toFixed(2)}`;
const fmtPct = (n: number) => `${Math.round(n)}%`;
function fmtMinutes(min: number | null): string {
  if (min === null) return '—';
  if (min < 60) return `${Math.round(min)} min`;
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}min`;
}

function defaultCustomDates() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function periodHref(p: Period) {
  return `/metricas?period=${p}`;
}

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: { period?: string; from?: string; to?: string };
}) {
  const period = (['week', 'month', 'all', 'custom'].includes(searchParams.period ?? '') ? searchParams.period : 'month') as Period;
  const defaults = defaultCustomDates();
  const fromStr = searchParams.from ?? defaults.from;
  const toStr = searchParams.to ?? defaults.to;
  const range = resolveRange(period, fromStr, toStr);

  const supabase = createAdminClient();

  // ---- Snapshot: estado actual de la plataforma, no depende del período ----
  let helpRequestsQuery = supabase.from('help_requests').select('status, created_at, accepted_at, businesses(city)');
  if (range) helpRequestsQuery = helpRequestsQuery.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());

  let reviewsQuery = supabase.from('reviews').select('rating, created_at').eq('is_public', true);
  if (range) reviewsQuery = reviewsQuery.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());

  let eventsQuery = supabase.from('business_metric_events').select('metric, created_at');
  if (range) eventsQuery = eventsQuery.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());

  let followsQuery = supabase.from('follows').select('created_at');
  if (range) followsQuery = followsQuery.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());

  let postsQuery = supabase.from('posts').select('created_at');
  if (range) postsQuery = postsQuery.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());

  let paymentsQuery = supabase.from('payments').select('amount, type, created_at').eq('status', 'completed');
  if (range) paymentsQuery = paymentsQuery.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());

  let newClientsQuery = supabase.from('users').select('created_at').eq('role', 'client');
  if (range) newClientsQuery = newClientsQuery.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());

  let newBusinessesQuery = supabase.from('businesses').select('created_at, business_type');
  if (range) newBusinessesQuery = newBusinessesQuery.gte('created_at', range.since.toISOString()).lt('created_at', range.until.toISOString());

  const [
    usersResult,
    businessesResult,
    subsResult,
    adsSnapshotResult,
    topFollowersResult,
    topRatedResult,
    paymentsAllTimeResult,
    helpRequestsAllTimeCountResult,
    helpRequestsResult,
    reviewsResult,
    eventsResult,
    followsResult,
    postsResult,
    paymentsResult,
    newClientsResult,
    newBusinessesResult,
  ] = await Promise.all([
    supabase.from('users').select('role'),
    supabase.from('businesses').select('business_type, is_verified, city, followers_count, subscription_plans(name, price_monthly)'),
    supabase.from('business_subscriptions').select('status'),
    supabase.from('ads').select('status'),
    supabase.from('businesses').select('id, name, city, followers_count').order('followers_count', { ascending: false }).limit(5),
    supabase.from('businesses').select('id, name, city, rating_avg').gt('rating_avg', 0).order('rating_avg', { ascending: false }).limit(5),
    supabase.from('payments').select('amount, type').eq('status', 'completed'),
    supabase.from('help_requests').select('id', { count: 'exact', head: true }),
    helpRequestsQuery,
    reviewsQuery,
    eventsQuery,
    followsQuery,
    postsQuery,
    paymentsQuery,
    newClientsQuery,
    newBusinessesQuery,
  ]);

  // ---- Período anterior (solo si hay un rango con el que comparar) ----
  const [prevPaymentsResult, prevHelpRequestsResult, prevReviewsResult, prevEventsResult, prevFollowsResult, prevPostsResult, prevNewClientsResult, prevNewBusinessesResult] =
    await Promise.all([
      range
        ? supabase.from('payments').select('amount, type').eq('status', 'completed').gte('created_at', range.prevSince.toISOString()).lt('created_at', range.prevUntil.toISOString())
        : Promise.resolve({ data: null, error: null }),
      range
        ? supabase.from('help_requests').select('status').gte('created_at', range.prevSince.toISOString()).lt('created_at', range.prevUntil.toISOString())
        : Promise.resolve({ data: null, error: null }),
      range
        ? supabase.from('reviews').select('rating').eq('is_public', true).gte('created_at', range.prevSince.toISOString()).lt('created_at', range.prevUntil.toISOString())
        : Promise.resolve({ data: null, error: null }),
      range
        ? supabase.from('business_metric_events').select('metric').gte('created_at', range.prevSince.toISOString()).lt('created_at', range.prevUntil.toISOString())
        : Promise.resolve({ data: null, error: null }),
      range
        ? supabase.from('follows').select('id', { count: 'exact', head: true }).gte('created_at', range.prevSince.toISOString()).lt('created_at', range.prevUntil.toISOString())
        : Promise.resolve({ count: null, error: null }),
      range
        ? supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', range.prevSince.toISOString()).lt('created_at', range.prevUntil.toISOString())
        : Promise.resolve({ count: null, error: null }),
      range
        ? supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'client').gte('created_at', range.prevSince.toISOString()).lt('created_at', range.prevUntil.toISOString())
        : Promise.resolve({ count: null, error: null }),
      range
        ? supabase.from('businesses').select('id', { count: 'exact', head: true }).gte('created_at', range.prevSince.toISOString()).lt('created_at', range.prevUntil.toISOString())
        : Promise.resolve({ count: null, error: null }),
    ]);

  const errors = [
    usersResult.error,
    businessesResult.error,
    subsResult.error,
    adsSnapshotResult.error,
    helpRequestsResult.error,
    reviewsResult.error,
    eventsResult.error,
    followsResult.error,
    postsResult.error,
    paymentsResult.error,
  ].filter(Boolean);

  // ---- Usuarios y negocios (snapshot) ----
  const users = usersResult.data ?? [];
  const usersByRole = {
    client: users.filter((u) => u.role === 'client').length,
    business: users.filter((u) => u.role === 'business').length,
    admin: users.filter((u) => u.role === 'admin').length,
  };

  const businesses = (businessesResult.data ?? []) as unknown as BusinessSnapshotRow[];
  const verifiedBusinesses = businesses.filter((b) => b.is_verified).length;
  const workshopCount = businesses.filter((b) => b.business_type === 'workshop').length;
  const storeCount = businesses.filter((b) => b.business_type === 'store').length;
  const mrr = businesses.reduce((s, b) => s + (b.subscription_plans?.price_monthly ?? 0), 0);

  const planMatrix: Record<string, Record<PlanName, number>> = {
    workshop: { free: 0, standard: 0, pro: 0 },
    store: { free: 0, standard: 0, pro: 0 },
  };
  for (const b of businesses) {
    const name = b.subscription_plans?.name;
    if (name && (b.business_type === 'workshop' || b.business_type === 'store')) planMatrix[b.business_type][name]++;
  }

  const subStatusCounts: Record<string, number> = { active: 0, expired: 0, cancelled: 0 };
  for (const s of subsResult.data ?? []) subStatusCounts[s.status] = (subStatusCounts[s.status] ?? 0) + 1;

  const adStatusCounts: Record<string, number> = {};
  for (const a of adsSnapshotResult.data ?? []) adStatusCounts[a.status] = (adStatusCounts[a.status] ?? 0) + 1;

  // ---- Ingresos ----
  const revenueAllTime = (paymentsAllTimeResult.data ?? []).reduce(
    (acc, p) => {
      acc.total += Number(p.amount);
      if (p.type === 'subscription') acc.subscription += Number(p.amount);
      if (p.type === 'advertising') acc.advertising += Number(p.amount);
      return acc;
    },
    { total: 0, subscription: 0, advertising: 0 }
  );

  const paymentsPeriod = (paymentsResult.data ?? []) as { amount: number; type: string; created_at: string }[];
  const revenuePeriod = paymentsPeriod.reduce(
    (acc, p) => {
      acc.total += Number(p.amount);
      if (p.type === 'subscription') acc.subscription += Number(p.amount);
      if (p.type === 'advertising') acc.advertising += Number(p.amount);
      return acc;
    },
    { total: 0, subscription: 0, advertising: 0 }
  );
  const revenuePrev = range
    ? (prevPaymentsResult.data ?? []).reduce(
        (acc: { total: number; subscription: number; advertising: number }, p: { amount: number; type: string }) => {
          acc.total += Number(p.amount);
          if (p.type === 'subscription') acc.subscription += Number(p.amount);
          if (p.type === 'advertising') acc.advertising += Number(p.amount);
          return acc;
        },
        { total: 0, subscription: 0, advertising: 0 }
      )
    : null;

  let revenueTrend: ReturnType<typeof buildSumChartPoints> = [];
  if (range) {
    const buckets = buildBuckets(range.since, range.until);
    revenueTrend = buildSumChartPoints(buckets, {
      subscription: paymentsPeriod.filter((p) => p.type === 'subscription').map((p) => ({ date: p.created_at, value: Number(p.amount) })),
      advertising: paymentsPeriod.filter((p) => p.type === 'advertising').map((p) => ({ date: p.created_at, value: Number(p.amount) })),
    });
  }

  // ---- Crecimiento (nuevos clientes / negocios) ----
  const newClients = (newClientsResult.data ?? []) as { created_at: string }[];
  const newBusinesses = (newBusinessesResult.data ?? []) as { created_at: string; business_type: BusinessType }[];
  let growthTrend: ReturnType<typeof buildCountChartPoints> = [];
  if (range) {
    const buckets = buildBuckets(range.since, range.until);
    growthTrend = buildCountChartPoints(buckets, {
      clients: newClients.map((c) => c.created_at),
      businesses: newBusinesses.map((b) => b.created_at),
    });
  }
  const newClientsPrev = range ? (prevNewClientsResult as { count: number | null }).count ?? 0 : null;
  const newBusinessesPrev = range ? (prevNewBusinessesResult as { count: number | null }).count ?? 0 : null;

  // ---- Auxilio en carretera ----
  const helpRequests = (helpRequestsResult.data ?? []) as unknown as HelpRequestRow[];
  const helpTotal = helpRequests.length;
  const helpCompleted = helpRequests.filter((h) => h.status === 'completed').length;
  const helpCancelled = helpRequests.filter((h) => h.status === 'cancelled').length;
  const helpStatusCounts: Record<string, number> = {};
  for (const h of helpRequests) helpStatusCounts[h.status] = (helpStatusCounts[h.status] ?? 0) + 1;
  const responseMinutes = helpRequests
    .filter((h) => h.accepted_at)
    .map((h) => (new Date(h.accepted_at as string).getTime() - new Date(h.created_at).getTime()) / 60000);
  const avgResponse = average(responseMinutes);
  const helpPrevTotal = range ? ((prevHelpRequestsResult.data ?? []) as { status: string }[]).length : null;

  let helpTrend: ReturnType<typeof buildCountChartPoints> = [];
  if (range) {
    const buckets = buildBuckets(range.since, range.until);
    helpTrend = buildCountChartPoints(buckets, { helpRequests: helpRequests.map((h) => h.created_at) });
  }

  const cityMap = new Map<string, { businesses: number; helpRequests: number }>();
  for (const b of businesses) {
    const entry = cityMap.get(b.city) ?? { businesses: 0, helpRequests: 0 };
    entry.businesses++;
    cityMap.set(b.city, entry);
  }
  for (const h of helpRequests) {
    const city = h.businesses?.city;
    if (!city) continue;
    const entry = cityMap.get(city) ?? { businesses: 0, helpRequests: 0 };
    entry.helpRequests++;
    cityMap.set(city, entry);
  }
  const cityRows = Array.from(cityMap.entries())
    .map(([city, stats]) => ({ city, ...stats }))
    .sort((a, b) => b.helpRequests - a.helpRequests);

  // ---- Reseñas ----
  const reviews = (reviewsResult.data ?? []) as { rating: number; created_at: string }[];
  const ratingAvg = average(reviews.map((r) => r.rating));
  const ratingAvgPrev = range ? average(((prevReviewsResult.data ?? []) as { rating: number }[]).map((r) => r.rating)) : null;
  const ratingDistribution = [1, 2, 3, 4, 5].map((star) => ({
    label: `${star}★`,
    values: { count: reviews.filter((r) => r.rating === star).length },
  }));

  // ---- Engagement (vistas, anuncios, historias, seguidores, posts) ----
  const events = (eventsResult.data ?? []) as { metric: string; created_at: string }[];
  const prevEvents = range ? ((prevEventsResult.data ?? []) as { metric: string }[]) : [];
  const byMetric = (metric: string) => events.filter((e) => e.metric === metric);
  const prevByMetricCount = (metric: string) => prevEvents.filter((e) => e.metric === metric).length;

  let engagementTrend: ReturnType<typeof buildCountChartPoints> = [];
  let socialTrend: ReturnType<typeof buildCountChartPoints> = [];
  const follows = (followsResult.data ?? []) as { created_at: string }[];
  const posts = (postsResult.data ?? []) as { created_at: string }[];
  if (range) {
    const buckets = buildBuckets(range.since, range.until);
    engagementTrend = buildCountChartPoints(buckets, {
      impressions: byMetric('ad_impression').map((e) => e.created_at),
      clicks: byMetric('ad_click').map((e) => e.created_at),
    });
    socialTrend = buildCountChartPoints(buckets, {
      posts: posts.map((p) => p.created_at),
      follows: follows.map((f) => f.created_at),
    });
  }
  const adImpressions = byMetric('ad_impression').length;
  const adClicks = byMetric('ad_click').length;
  const ctr = adImpressions > 0 ? (adClicks / adImpressions) * 100 : null;
  const followsPrev = range ? (prevFollowsResult as { count: number | null }).count ?? 0 : null;
  const postsPrev = range ? (prevPostsResult as { count: number | null }).count ?? 0 : null;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Métricas</h1>
      <p className="mb-4 text-sm text-gray-500">Estadísticas generales de la plataforma, con gráficas y comparación contra el período anterior.</p>

      {errors.length > 0 && (
        <p className="mb-4 text-sm text-red-600">Error cargando algunos datos: {errors.map((e) => e?.message).join(' · ')}</p>
      )}

      {/* Selector de período */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(['week', 'month', 'all', 'custom'] as Period[]).map((p) =>
          p === period ? (
            <span key={p} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
              {PERIOD_LABEL[p]}
            </span>
          ) : (
            <a key={p} href={periodHref(p)} className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
              {PERIOD_LABEL[p]}
            </a>
          )
        )}
        <form method="get" action="/metricas" className="ml-2 flex items-center gap-1.5">
          <input type="hidden" name="period" value="custom" />
          <input type="date" name="from" defaultValue={fromStr} className="rounded-lg border border-gray-200 px-2 py-1 text-xs" />
          <span className="text-xs text-gray-400">a</span>
          <input type="date" name="to" defaultValue={toStr} className="rounded-lg border border-gray-200 px-2 py-1 text-xs" />
          <button type="submit" className="rounded-lg bg-gray-900 px-3 py-1 text-xs font-semibold text-white hover:bg-gray-700">
            Aplicar
          </button>
        </form>
      </div>
      {range && (
        <p className="mb-6 text-xs text-gray-400">
          {range.since.toLocaleDateString('es-EC')} — {range.until.toLocaleDateString('es-EC')}
        </p>
      )}
      {!range && <p className="mb-6 text-xs text-gray-400">Todo el historial</p>}

      {/* KPIs generales (siempre totales de siempre, no varían con el período) */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Clientes" value={fmtInt(usersByRole.client)} />
        <Kpi label="Negocios" value={fmtInt(businesses.length)} sub={`${workshopCount} talleres · ${storeCount} tiendas`} />
        <Kpi label="Negocios verificados" value={fmtInt(verifiedBusinesses)} />
        <Kpi label="Solicitudes de auxilio (histórico)" value={fmtInt(helpRequestsAllTimeCountResult.count ?? 0)} />
        <Kpi label="Ingresos totales" value={fmtMoney(revenueAllTime.total)} accent />
        <Kpi label="Ingresos por suscripciones" value={fmtMoney(revenueAllTime.subscription)} />
        <Kpi label="Ingresos por publicidad" value={fmtMoney(revenueAllTime.advertising)} />
        <Kpi label="MRR estimado (planes actuales)" value={fmtMoney(mrr)} accent />
      </div>

      {/* Crecimiento */}
      <Section title="Crecimiento">
        <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-2">
          <MiniStat label="Nuevos clientes" value={fmtInt(newClients.length)} curr={newClients.length} prev={newClientsPrev} />
          <MiniStat label="Nuevos negocios" value={fmtInt(newBusinesses.length)} curr={newBusinesses.length} prev={newBusinessesPrev} />
        </div>
        {range ? (
          <BarChart
            data={growthTrend}
            series={[
              { key: 'clients', label: 'Clientes', color: '#FF6B00' },
              { key: 'businesses', label: 'Negocios', color: '#2E7D32' },
            ]}
          />
        ) : (
          <p className="text-xs text-gray-400">Elige Semana, Mes o Rango para ver la tendencia.</p>
        )}
      </Section>

      {/* Ingresos */}
      <Section title="Ingresos del período">
        <div className="mb-3 grid grid-cols-3 gap-4">
          <MiniStat label="Total" value={fmtMoney(revenuePeriod.total)} curr={revenuePeriod.total} prev={revenuePrev?.total ?? null} isMoney />
          <MiniStat label="Suscripciones" value={fmtMoney(revenuePeriod.subscription)} curr={revenuePeriod.subscription} prev={revenuePrev?.subscription ?? null} isMoney />
          <MiniStat label="Publicidad" value={fmtMoney(revenuePeriod.advertising)} curr={revenuePeriod.advertising} prev={revenuePrev?.advertising ?? null} isMoney />
        </div>
        {range ? (
          <BarChart
            data={revenueTrend}
            series={[
              { key: 'subscription', label: 'Suscripciones', color: '#FF6B00' },
              { key: 'advertising', label: 'Publicidad', color: '#2E7D32' },
            ]}
            valueFormatter={(n) => `$${n}`}
          />
        ) : (
          <p className="text-xs text-gray-400">Elige Semana, Mes o Rango para ver la tendencia.</p>
        )}
      </Section>

      {/* Auxilio en carretera */}
      <Section title="Auxilio en carretera">
        <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <MiniStat label="Solicitudes" value={fmtInt(helpTotal)} curr={helpTotal} prev={helpPrevTotal} />
          <Kpi label="Completadas" value={fmtInt(helpCompleted)} />
          <Kpi label="Canceladas" value={fmtInt(helpCancelled)} />
          <Kpi label="Tasa de finalización" value={helpTotal > 0 ? fmtPct((helpCompleted / helpTotal) * 100) : '—'} />
          <Kpi label="Tiempo de respuesta promedio" value={fmtMinutes(avgResponse)} />
        </div>
        {range && (
          <div className="mb-4">
            <BarChart data={helpTrend} series={[{ key: 'helpRequests', label: 'Solicitudes', color: '#FF6B00' }]} />
          </div>
        )}
        <p className="mb-1 text-xs font-semibold text-gray-500">Por estado</p>
        <BarChart
          data={Object.keys(HELP_STATUS_LABEL).map((k) => ({ label: HELP_STATUS_LABEL[k], values: { count: helpStatusCounts[k] ?? 0 } }))}
          series={[{ key: 'count', label: 'Solicitudes', color: '#FF6B00' }]}
        />
      </Section>

      {/* Reseñas */}
      <Section title="Reseñas">
        <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-2">
          <MiniStat
            label="Calificación promedio"
            value={ratingAvg !== null ? ratingAvg.toFixed(2) : '—'}
            curr={ratingAvg ?? 0}
            prev={ratingAvgPrev}
            hidePrevWhenEmpty={ratingAvg === null}
          />
          <Kpi label="Reseñas del período" value={fmtInt(reviews.length)} />
        </div>
        <p className="mb-1 text-xs font-semibold text-gray-500">Distribución de calificaciones</p>
        <BarChart data={ratingDistribution} series={[{ key: 'count', label: 'Reseñas', color: '#FF6B00' }]} />
      </Section>

      {/* Publicidad y engagement */}
      <Section title="Publicidad y contenido">
        <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi label="Impresiones (período)" value={fmtInt(adImpressions)} />
          <Kpi label="Clics (período)" value={fmtInt(adClicks)} />
          <Kpi label="CTR" value={ctr !== null ? fmtPct(ctr) : '—'} />
          <MiniStat label="Nuevos seguimientos" value={fmtInt(follows.length)} curr={follows.length} prev={followsPrev} />
        </div>
        {range ? (
          <>
            <p className="mb-1 text-xs font-semibold text-gray-500">Impresiones vs. clics de publicidad</p>
            <div className="mb-4">
              <BarChart
                data={engagementTrend}
                series={[
                  { key: 'impressions', label: 'Impresiones', color: '#FF6B00' },
                  { key: 'clicks', label: 'Clics', color: '#2E7D32' },
                ]}
              />
            </div>
            <p className="mb-1 text-xs font-semibold text-gray-500">Publicaciones vs. nuevos seguimientos</p>
            <BarChart
              data={socialTrend}
              series={[
                { key: 'posts', label: 'Publicaciones', color: '#FF6B00' },
                { key: 'follows', label: 'Seguimientos', color: '#2E7D32' },
              ]}
            />
            <p className="mt-2 text-xs text-gray-400">Publicaciones nuevas: {fmtInt(posts.length)} {postsPrev !== null && `(anterior: ${fmtInt(postsPrev)})`}</p>
          </>
        ) : (
          <p className="text-xs text-gray-400">Elige Semana, Mes o Rango para ver la tendencia. Publicaciones nuevas: {fmtInt(posts.length)}.</p>
        )}
      </Section>

      {/* Planes y suscripciones */}
      <Section title="Planes y suscripciones">
        <div className="mb-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-3 py-2">Tipo de negocio</th>
                <th className="px-3 py-2">Free</th>
                <th className="px-3 py-2">Estándar</th>
                <th className="px-3 py-2">Pro</th>
              </tr>
            </thead>
            <tbody>
              {(['workshop', 'store'] as const).map((type) => (
                <tr key={type} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-medium">{BUSINESS_TYPE_LABEL[type]}</td>
                  <td className="px-3 py-2">{planMatrix[type].free}</td>
                  <td className="px-3 py-2">{planMatrix[type].standard}</td>
                  <td className="px-3 py-2">{planMatrix[type].pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mb-1 text-xs font-semibold text-gray-500">Estado de suscripciones (histórico)</p>
        <BarChart
          data={Object.keys(SUB_STATUS_LABEL).map((k) => ({ label: SUB_STATUS_LABEL[k], values: { count: subStatusCounts[k] ?? 0 } }))}
          series={[{ key: 'count', label: 'Suscripciones', color: '#FF6B00' }]}
        />
      </Section>

      {/* Publicidad -- estado de campañas */}
      <Section title="Campañas de publicidad (estado actual)">
        <BarChart
          data={Object.keys(AD_STATUS_LABEL).map((k) => ({ label: AD_STATUS_LABEL[k], values: { count: adStatusCounts[k] ?? 0 } }))}
          series={[{ key: 'count', label: 'Campañas', color: '#FF6B00' }]}
        />
      </Section>

      {/* Top negocios */}
      <Section title="Top negocios">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-500">Más seguidores</p>
            <RankedList
              rows={(topFollowersResult.data ?? []).map((b) => ({ id: b.id, name: b.name, sub: b.city, value: `${b.followers_count} seguidores` }))}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-500">Mejor calificados</p>
            <RankedList
              rows={(topRatedResult.data ?? []).map((b) => ({ id: b.id, name: b.name, sub: b.city, value: `${Number(b.rating_avg).toFixed(1)}★` }))}
            />
          </div>
        </div>
      </Section>

      {/* Ciudad */}
      <Section title="Demanda vs. cobertura por ciudad">
        <p className="mb-3 text-xs text-gray-500">
          Negocios registrados (total actual) y solicitudes de auxilio del período por ciudad — útil para detectar zonas con demanda pero pocos talleres.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-3 py-2">Ciudad</th>
                <th className="px-3 py-2">Negocios</th>
                <th className="px-3 py-2">Solicitudes de auxilio</th>
              </tr>
            </thead>
            <tbody>
              {cityRows.map((row) => (
                <tr key={row.city} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-medium">{row.city}</td>
                  <td className="px-3 py-2">{row.businesses}</td>
                  <td className="px-3 py-2">{row.helpRequests}</td>
                </tr>
              ))}
              {cityRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                    Todavía no hay datos suficientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-primary' : ''}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  curr,
  prev,
  isMoney,
  hidePrevWhenEmpty,
}: {
  label: string;
  value: string | number;
  curr: number;
  prev: number | null;
  isMoney?: boolean;
  hidePrevWhenEmpty?: boolean;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold">
        {value}
        {!hidePrevWhenEmpty && <ComparisonBadge curr={curr} prev={prev} isMoney={isMoney} />}
      </p>
    </div>
  );
}

function ComparisonBadge({ curr, prev, isMoney }: { curr: number; prev: number | null; isMoney?: boolean }) {
  if (prev === null) return null;
  const delta = curr - prev;
  if (delta === 0 && prev === 0) return null;
  const pct = prev > 0 ? Math.round((delta / prev) * 100) : null;
  const flat = delta === 0;
  const up = delta > 0;
  const color = flat ? 'text-gray-400' : up ? 'text-green-700' : 'text-red-600';
  const arrow = flat ? '→' : up ? '↑' : '↓';
  const magnitude = pct !== null ? `${Math.abs(pct)}%` : isMoney ? `$${Math.abs(delta).toFixed(2)}` : `${Math.abs(delta)}`;
  return <span className={`ml-2 text-xs font-semibold ${color}`}>{arrow} {magnitude}</span>;
}

function RankedList({ rows }: { rows: { id: string; name: string; sub: string; value: string }[] }) {
  if (rows.length === 0) return <p className="text-xs text-gray-400">Sin datos todavía.</p>;
  return (
    <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
      {rows.map((r, i) => (
        <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">
            <span className="mr-2 text-xs text-gray-400">#{i + 1}</span>
            <span className="font-medium">{r.name}</span>
            <span className="ml-1 text-xs text-gray-400">{r.sub}</span>
          </span>
          <span className="whitespace-nowrap text-xs font-semibold text-primary">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
