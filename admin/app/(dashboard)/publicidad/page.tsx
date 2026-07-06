import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminAdRow } from '../../../lib/types';
import { Paginator } from '../../../components/Paginator';
import { AdPauseButton } from './AdPauseButton';
import { AdReviewActions } from './AdReviewActions';

const PAGE_SIZE = 12;

const AD_SELECT =
  'id, business_id, title, image_url, link_url, target_city, status, starts_at, ends_at, impressions, clicks, created_at, businesses(name)';

export default async function PublicidadPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createAdminClient();

  const [pendingResult, activeResult, revenueResult] = await Promise.all([
    supabase.from('ads').select(AD_SELECT).eq('status', 'pending_review').order('created_at', { ascending: true }),
    supabase
      .from('ads')
      .select(AD_SELECT, { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase.from('payments').select('amount').eq('type', 'advertising').eq('status', 'completed'),
  ]);

  const pending = (pendingResult.data ?? []) as unknown as AdminAdRow[];
  const active = (activeResult.data ?? []) as unknown as AdminAdRow[];
  const totalRevenue = (revenueResult.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPages = activeResult.count ? Math.ceil(activeResult.count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">Publicidad</h1>
      <p className="mb-4 text-sm text-gray-500">
        Cada campaña paga vía Payphone y queda en revisión hasta que se aprueba aquí. Una vez activa, se muestra
        automáticamente en inicio, búsqueda y perfiles relevantes.
      </p>

      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <p className="text-xs text-gray-500">Ingresos por publicidad (campañas pagadas y completadas)</p>
        <p className="text-2xl font-bold text-primary">${totalRevenue.toFixed(2)}</p>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Pendientes de revisión ({pending.length})</h2>
      {pendingResult.error && <p className="text-sm text-red-600">Error: {pendingResult.error.message}</p>}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {pending.map((ad) => (
          <div key={ad.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
            <img src={ad.image_url} alt="" className="h-40 w-full object-cover" />
            <div className="p-3">
              <p className="text-sm font-semibold">{ad.title}</p>
              <p className="text-xs text-gray-500">{ad.businesses?.name ?? 'Negocio'}</p>
              <p className="mt-1 text-xs text-gray-400">{ad.target_city ?? 'Nacional'}</p>
              <p className="text-xs text-gray-400">
                {new Date(ad.starts_at).toLocaleDateString('es-EC')} – {new Date(ad.ends_at).toLocaleDateString('es-EC')}
              </p>
              {ad.link_url && (
                <a href={ad.link_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                  Ver link
                </a>
              )}
              <AdReviewActions adId={ad.id} />
            </div>
          </div>
        ))}
        {pending.length === 0 && !pendingResult.error && (
          <p className="text-sm text-gray-500">No hay campañas pendientes de revisión.</p>
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold">
        Activas{activeResult.count != null ? ` (${activeResult.count})` : ''}
      </h2>
      {activeResult.error && <p className="text-sm text-red-600">Error: {activeResult.error.message}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {active.map((ad) => (
          <div key={ad.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
            <img src={ad.image_url} alt="" className="h-40 w-full object-cover" />
            <div className="p-3">
              <p className="text-sm font-semibold">{ad.title}</p>
              <p className="text-xs text-gray-500">{ad.businesses?.name ?? 'Negocio'}</p>
              <p className="mt-1 text-xs text-gray-400">{ad.target_city ?? 'Nacional'}</p>
              <p className="text-xs text-gray-400">
                {new Date(ad.starts_at).toLocaleDateString('es-EC')} – {new Date(ad.ends_at).toLocaleDateString('es-EC')}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {ad.impressions} impresiones · {ad.clicks} clics
              </p>
              <AdPauseButton adId={ad.id} />
            </div>
          </div>
        ))}
        {active.length === 0 && !activeResult.error && <p className="text-sm text-gray-500">No hay campañas activas.</p>}
      </div>
      <Paginator page={page} totalPages={totalPages} buildHref={(p) => `?page=${p}`} />
    </div>
  );
}
