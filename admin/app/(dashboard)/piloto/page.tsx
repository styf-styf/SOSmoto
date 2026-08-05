import { createAdminClient } from '../../../lib/supabase/admin';

// Fecha de lanzamiento del piloto (publicación del APK, 2026-08-03) -- todo
// en esta pantalla se mide desde aquí, no desde el selector de período de
// /metricas. Esta pantalla es temporal a propósito: bórrala cuando el
// piloto termine (no lleva expiración automática, se pidió quitarla
// manualmente cuando el usuario lo indique).
const PILOT_START = '2026-08-03T00:00:00.000Z';
const PILOT_DURATION_DAYS = 30;

const BUSINESS_TYPE_LABEL: Record<string, string> = { workshop: 'Taller', store: 'Tienda', brand_advertiser: 'Marca (legado)' };
const HELP_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  in_progress: 'En camino',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

interface FeedItem {
  id: string;
  created_at: string;
  kind: 'client' | 'business' | 'help' | 'review';
  label: string;
  sub: string;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default async function PilotoPage() {
  const supabase = createAdminClient();

  const [clientsResult, businessesResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, email, created_at')
      .eq('role', 'client')
      .gte('created_at', PILOT_START)
      .order('created_at', { ascending: false }),
    supabase
      .from('businesses')
      .select('id, name, business_type, city, is_verified, created_at')
      .gte('created_at', PILOT_START)
      .order('created_at', { ascending: true }),
  ]);

  const clients = clientsResult.data ?? [];
  const businesses = businessesResult.data ?? [];
  const businessIds = businesses.map((b) => b.id);
  const clientIds = clients.map((c) => c.id);

  const [
    productsResult,
    servicesResult,
    helpRequestsByClientResult,
    reviewsByClientResult,
    followsByClientResult,
    productIntentsResult,
    serviceIntentsResult,
    recentHelpRequestsResult,
    recentReviewsResult,
  ] = await Promise.all([
    businessIds.length ? supabase.from('products').select('business_id').in('business_id', businessIds) : Promise.resolve({ data: [] as { business_id: string }[], error: null }),
    businessIds.length ? supabase.from('services').select('business_id').in('business_id', businessIds) : Promise.resolve({ data: [] as { business_id: string }[], error: null }),
    clientIds.length ? supabase.from('help_requests').select('client_id').in('client_id', clientIds) : Promise.resolve({ data: [] as { client_id: string }[], error: null }),
    clientIds.length ? supabase.from('reviews').select('reviewer_id').in('reviewer_id', clientIds) : Promise.resolve({ data: [] as { reviewer_id: string }[], error: null }),
    clientIds.length ? supabase.from('follows').select('client_id').in('client_id', clientIds) : Promise.resolve({ data: [] as { client_id: string }[], error: null }),
    clientIds.length ? supabase.from('product_intents').select('client_id').in('client_id', clientIds) : Promise.resolve({ data: [] as { client_id: string }[], error: null }),
    clientIds.length ? supabase.from('service_intents').select('client_id').in('client_id', clientIds) : Promise.resolve({ data: [] as { client_id: string }[], error: null }),
    supabase
      .from('help_requests')
      .select('id, status, created_at, users(full_name)')
      .gte('created_at', PILOT_START)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('reviews')
      .select(
        'id, rating, comment, created_at, reviewer:users!reviews_reviewer_id_fkey(full_name), reviewed_business:businesses!reviews_reviewed_business_id_fkey(name)'
      )
      .eq('is_public', true)
      .gte('created_at', PILOT_START)
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const errors = [
    clientsResult.error,
    businessesResult.error,
    productsResult.error,
    servicesResult.error,
    helpRequestsByClientResult.error,
    reviewsByClientResult.error,
    followsByClientResult.error,
    productIntentsResult.error,
    serviceIntentsResult.error,
    recentHelpRequestsResult.error,
    recentReviewsResult.error,
  ].filter(Boolean);

  // ---- Embudo de negocios: registrado -> con catálogo -> verificado ----
  const businessesWithCatalog = new Set<string>([
    ...(productsResult.data ?? []).map((p) => p.business_id),
    ...(servicesResult.data ?? []).map((s) => s.business_id),
  ]);
  const businessesWithoutCatalog = businesses.filter((b) => !businessesWithCatalog.has(b.id)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const verifiedCount = businesses.filter((b) => b.is_verified).length;

  // ---- Clientes registrados que nunca hicieron nada -- ni un auxilio, ni
  // una reseña, ni siguieron a nadie, ni apartaron un producto/servicio.
  // No hay tabla de "última sesión" en el esquema, así que esto es la mejor
  // aproximación disponible a "cliente inactivo" sin agregar tracking nuevo.
  const activeClientIds = new Set<string>([
    ...(helpRequestsByClientResult.data ?? []).map((h) => h.client_id),
    ...(reviewsByClientResult.data ?? []).map((r) => r.reviewer_id),
    ...(followsByClientResult.data ?? []).map((f) => f.client_id),
    ...(productIntentsResult.data ?? []).map((p) => p.client_id),
    ...(serviceIntentsResult.data ?? []).map((s) => s.client_id),
  ]);
  const clientsWithoutActivity = clients.filter((c) => !activeClientIds.has(c.id));

  // ---- Feed de actividad real cruda -- para confirmar de un vistazo que
  // el piloto está pasando cosas de verdad, no solo mirar números agregados.
  const feed: FeedItem[] = [
    ...clients.map((c) => ({ id: `c-${c.id}`, created_at: c.created_at, kind: 'client' as const, label: 'Nuevo cliente', sub: c.full_name })),
    ...businesses.map((b) => ({
      id: `b-${b.id}`,
      created_at: b.created_at,
      kind: 'business' as const,
      label: `Nuevo negocio · ${BUSINESS_TYPE_LABEL[b.business_type] ?? b.business_type}`,
      sub: `${b.name} · ${b.city}`,
    })),
    ...((recentHelpRequestsResult.data ?? []) as unknown as { id: string; status: string; created_at: string; users: { full_name: string } | null }[]).map(
      (h) => ({
        id: `h-${h.id}`,
        created_at: h.created_at,
        kind: 'help' as const,
        label: `Auxilio · ${HELP_STATUS_LABEL[h.status] ?? h.status}`,
        sub: h.users?.full_name ?? '—',
      })
    ),
    ...(
      (recentReviewsResult.data ?? []) as unknown as {
        id: string;
        rating: number;
        created_at: string;
        reviewer: { full_name: string } | null;
        reviewed_business: { name: string } | null;
      }[]
    ).map((r) => ({
      id: `r-${r.id}`,
      created_at: r.created_at,
      kind: 'review' as const,
      label: `Reseña ${r.rating}★`,
      sub: `${r.reviewer?.full_name ?? '—'} → ${r.reviewed_business?.name ?? '—'}`,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  const pilotDay = daysSince(PILOT_START) + 1;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Piloto</h1>
      <p className="mb-4 text-sm text-gray-500">
        Solo para el lanzamiento piloto -- todo se mide desde el {new Date(PILOT_START).toLocaleDateString('es-EC')}. Día {pilotDay} de{' '}
        {PILOT_DURATION_DAYS}. Esta pantalla se quita cuando el piloto termine.
      </p>

      {errors.length > 0 && (
        <p className="mb-4 text-sm text-red-600">Error cargando algunos datos: {errors.map((e) => e?.message).join(' · ')}</p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Clientes registrados" value={clients.length} />
        <Kpi label="Negocios registrados" value={businesses.length} />
        <Kpi label="Negocios verificados" value={verifiedCount} />
        <Kpi
          label="Negocios con catálogo"
          value={`${businesses.length - businessesWithoutCatalog.length}/${businesses.length}`}
          accent
        />
      </div>

      <Section title="Negocios sin catálogo todavía" subtitle="Registrados en el piloto pero sin ningún producto ni servicio -- candidatos a llamar/ayudar a cargar catálogo. Ordenados por más antiguos primero.">
        {businessesWithoutCatalog.length === 0 ? (
          <p className="text-sm text-gray-400">Todos los negocios del piloto ya tienen catálogo.</p>
        ) : (
          <Table
            headers={['Negocio', 'Tipo', 'Ciudad', 'Días desde registro']}
            rows={businessesWithoutCatalog.map((b) => [b.name, BUSINESS_TYPE_LABEL[b.business_type] ?? b.business_type, b.city, String(daysSince(b.created_at))])}
          />
        )}
      </Section>

      <Section title="Clientes sin actividad" subtitle="Se registraron pero nunca pidieron auxilio, dejaron reseña, siguieron a un negocio, ni apartaron un producto/servicio.">
        {clientsWithoutActivity.length === 0 ? (
          <p className="text-sm text-gray-400">Todos los clientes del piloto tienen alguna actividad.</p>
        ) : (
          <Table
            headers={['Cliente', 'Email', 'Días desde registro']}
            rows={clientsWithoutActivity.map((c) => [c.full_name, c.email, String(daysSince(c.created_at))])}
          />
        )}
      </Section>

      <Section title="Actividad reciente" subtitle="Últimos eventos reales del piloto, sin agregar -- para confirmar de un vistazo que está pasando algo de verdad.">
        {feed.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no hay actividad.</p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {feed.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{item.label}</span>
                  <span className="ml-1.5 text-xs text-gray-400">{item.sub}</span>
                </span>
                <span className="whitespace-nowrap text-xs text-gray-400">{fmtDate(item.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="rounded-xl bg-gray-50 p-4 text-xs text-gray-500">
        Nota: la conversión de descargas del APK a registros no se puede medir todavía -- sosmoto.net sirve el archivo
        directo desde Vercel Blob y no hay ningún evento de descarga registrado en la base.
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
      <p className="mb-1 text-sm font-semibold">{title}</p>
      {subtitle && <p className="mb-3 text-xs text-gray-500">{subtitle}</p>}
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
