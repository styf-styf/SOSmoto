import { createAdminClient } from '../../../lib/supabase/admin';

export default async function MetricasPage() {
  const supabase = createAdminClient();

  const [usersResult, businessesResult, helpRequestsResult, paymentsResult] = await Promise.all([
    supabase.from('users').select('role'),
    supabase.from('businesses').select('business_type, city, is_verified, is_suspended'),
    supabase.from('help_requests').select('status, accepted_business_id, businesses(city)'),
    supabase.from('payments').select('amount, type, status'),
  ]);

  const users = usersResult.data ?? [];
  const usersByRole = {
    client: users.filter((u) => u.role === 'client').length,
    business: users.filter((u) => u.role === 'business').length,
    admin: users.filter((u) => u.role === 'admin').length,
  };

  const businesses = businessesResult.data ?? [];
  const activeBusinesses = businesses.filter((b) => !b.is_suspended);
  const verifiedBusinesses = businesses.filter((b) => b.is_verified).length;

  const helpRequests = (helpRequestsResult.data ?? []) as unknown as {
    status: string;
    accepted_business_id: string | null;
    businesses: { city: string } | null;
  }[];

  const revenueByType = (paymentsResult.data ?? [])
    .filter((p) => p.status === 'completed')
    .reduce(
      (acc, p) => {
        acc.total += Number(p.amount);
        if (p.type === 'subscription') acc.subscription += Number(p.amount);
        if (p.type === 'advertising') acc.advertising += Number(p.amount);
        return acc;
      },
      { total: 0, subscription: 0, advertising: 0 }
    );

  const cityMap = new Map<string, { businesses: number; helpRequests: number }>();
  for (const b of activeBusinesses) {
    const entry = cityMap.get(b.city) ?? { businesses: 0, helpRequests: 0 };
    entry.businesses++;
    cityMap.set(b.city, entry);
  }
  for (const r of helpRequests) {
    const city = r.businesses?.city;
    if (!city) continue;
    const entry = cityMap.get(city) ?? { businesses: 0, helpRequests: 0 };
    entry.helpRequests++;
    cityMap.set(city, entry);
  }
  const cityRows = Array.from(cityMap.entries())
    .map(([city, stats]) => ({ city, ...stats }))
    .sort((a, b) => b.helpRequests - a.helpRequests);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Métricas generales</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Clientes</p>
          <p className="text-2xl font-bold">{usersByRole.client}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Negocios activos</p>
          <p className="text-2xl font-bold">{activeBusinesses.length}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Negocios verificados</p>
          <p className="text-2xl font-bold">{verifiedBusinesses}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Solicitudes de auxilio</p>
          <p className="text-2xl font-bold">{helpRequests.length}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Ingresos totales</p>
          <p className="text-2xl font-bold text-primary">${revenueByType.total.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Ingresos por suscripciones</p>
          <p className="text-2xl font-bold">${revenueByType.subscription.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Ingresos por publicidad</p>
          <p className="text-2xl font-bold">${revenueByType.advertising.toFixed(2)}</p>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Demanda vs. cobertura por ciudad</h2>
      <p className="mb-4 text-sm text-gray-500">
        Negocios activos y solicitudes de auxilio aceptadas por ciudad — útil para detectar zonas con demanda pero
        pocos talleres registrados.
      </p>
      <table className="w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-3">Ciudad</th>
            <th className="px-4 py-3">Negocios activos</th>
            <th className="px-4 py-3">Solicitudes de auxilio</th>
          </tr>
        </thead>
        <tbody>
          {cityRows.map((row) => (
            <tr key={row.city} className="border-b border-gray-100">
              <td className="px-4 py-3 font-medium">{row.city}</td>
              <td className="px-4 py-3">{row.businesses}</td>
              <td className="px-4 py-3">{row.helpRequests}</td>
            </tr>
          ))}
          {cityRows.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                Todavía no hay datos suficientes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
