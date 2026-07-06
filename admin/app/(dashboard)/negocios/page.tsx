import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminBusinessRow, BusinessType } from '../../../lib/types';
import { Paginator } from '../../../components/Paginator';
import { BusinessActions } from './BusinessActions';

const PAGE_SIZE = 25;

const typeLabel: Record<BusinessType, string> = {
  workshop: 'Taller',
  store: 'Tienda',
  brand_advertiser: 'Marca/proveedor',
};

export default async function NegociosPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; page?: string };
}) {
  const q = searchParams.q?.trim() ?? '';
  const type = searchParams.type ?? '';
  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createAdminClient();
  let query = supabase
    .from('businesses')
    .select(
      'id, owner_id, business_type, name, city, is_verified, is_limited, limitation_reason, followers_count, rating_avg, created_at, subscription_plans(name), users(full_name, email)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%`);
  if (type) query = query.eq('business_type', type);

  const { data, count, error } = await query;
  const businesses = (data ?? []) as unknown as AdminBusinessRow[];
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Usuarios y negocios</h1>

      <div className="mb-4 flex gap-4 border-b border-gray-200">
        <a href="/usuarios" className="px-1 pb-2 text-sm font-medium text-gray-500">
          Usuarios
        </a>
        <span className="border-b-2 border-primary px-1 pb-2 text-sm font-semibold text-primary">Negocios</span>
      </div>

      <form method="get" className="mb-4 flex gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o ciudad"
          className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select name="type" defaultValue={type} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">Todos los tipos</option>
          <option value="workshop">Taller</option>
          <option value="store">Tienda</option>
          <option value="brand_advertiser">Marca/proveedor</option>
        </select>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
          Buscar
        </button>
      </form>

      {error && <p className="text-sm text-red-600">Error cargando negocios: {error.message}</p>}

      <table className="w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-3">Negocio</th>
            <th className="px-4 py-3">Dueño</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Ciudad</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Verificado</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {businesses.map((business) => (
            <tr key={business.id} className="border-b border-gray-100">
              <td className="px-4 py-3 font-medium">{business.name}</td>
              <td className="px-4 py-3">{business.users?.full_name ?? '—'}</td>
              <td className="px-4 py-3">{typeLabel[business.business_type]}</td>
              <td className="px-4 py-3">{business.city}</td>
              <td className="px-4 py-3 capitalize">{business.subscription_plans?.name ?? '—'}</td>
              <td className="px-4 py-3">{business.is_verified ? 'Sí' : 'No'}</td>
              <td className="px-4 py-3">
                <span className={business.is_limited ? 'text-amber-600' : 'text-green-700'}>
                  {business.is_limited ? 'Limitado' : 'Activo'}
                </span>
                {business.is_limited && business.limitation_reason && (
                  <p className="mt-1 max-w-[220px] text-xs text-gray-500">{business.limitation_reason}</p>
                )}
              </td>
              <td className="px-4 py-3">
                <BusinessActions businessId={business.id} isLimited={business.is_limited} />
              </td>
            </tr>
          ))}
          {businesses.length === 0 && !error && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                No se encontraron negocios.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Paginator
        page={page}
        totalPages={totalPages}
        buildHref={(p) => `?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&page=${p}`}
      />
    </div>
  );
}
