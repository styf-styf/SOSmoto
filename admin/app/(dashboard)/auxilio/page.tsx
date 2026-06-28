import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminHelpRequestRow, HelpRequestStatus } from '../../../lib/types';

const PAGE_SIZE = 25;

const statusLabel: Record<HelpRequestStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const statusColor: Record<HelpRequestStatus, string> = {
  pending: 'text-yellow-600',
  accepted: 'text-blue-600',
  in_progress: 'text-blue-600',
  completed: 'text-green-700',
  cancelled: 'text-red-600',
};

export default async function AuxilioPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createAdminClient();

  const [statsResult, listResult] = await Promise.all([
    supabase.from('help_requests').select('status, accepted_business_id, created_at, accepted_at'),
    supabase
      .from('help_requests')
      .select(
        'id, client_id, status, accepted_business_id, estimated_arrival_minutes, created_at, accepted_at, completed_at, users(full_name), businesses(name, city)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to),
  ]);

  const statsRows = statsResult.data ?? [];
  const total = statsRows.length;
  const acceptedCount = statsRows.filter((r) => r.accepted_business_id !== null).length;
  const acceptanceRate = total > 0 ? (acceptedCount / total) * 100 : 0;
  const responseTimes = statsRows
    .filter((r) => r.accepted_at !== null)
    .map((r) => (new Date(r.accepted_at as string).getTime() - new Date(r.created_at).getTime()) / 60000);
  const avgResponseMinutes =
    responseTimes.length > 0 ? responseTimes.reduce((sum, m) => sum + m, 0) / responseTimes.length : null;

  const statusCounts: Record<HelpRequestStatus, number> = {
    pending: 0,
    accepted: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const row of statsRows) statusCounts[row.status as HelpRequestStatus]++;

  const requests = (listResult.data ?? []) as unknown as AdminHelpRequestRow[];
  const totalPages = listResult.count ? Math.ceil(listResult.count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Auxilio en carretera</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Solicitudes totales</p>
          <p className="text-2xl font-bold">{total}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Tasa de aceptación</p>
          <p className="text-2xl font-bold text-primary">{acceptanceRate.toFixed(0)}%</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Tiempo promedio de respuesta</p>
          <p className="text-2xl font-bold">{avgResponseMinutes !== null ? `${avgResponseMinutes.toFixed(0)} min` : '—'}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Canceladas</p>
          <p className="text-2xl font-bold">{statusCounts.cancelled}</p>
        </div>
      </div>

      <div className="mb-6 flex gap-4 rounded-xl bg-white p-4 text-sm shadow-sm">
        {Object.entries(statusCounts).map(([status, count]) => (
          <span key={status} className={statusColor[status as HelpRequestStatus]}>
            {statusLabel[status as HelpRequestStatus]}: <strong>{count}</strong>
          </span>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Historial de solicitudes</h2>
      {listResult.error && <p className="text-sm text-red-600">Error: {listResult.error.message}</p>}

      <table className="w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Taller</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">ETA</th>
            <th className="px-4 py-3">Creada</th>
            <th className="px-4 py-3">Aceptada</th>
            <th className="px-4 py-3">Completada</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-b border-gray-100">
              <td className="px-4 py-3 font-medium">{r.users?.full_name ?? '—'}</td>
              <td className="px-4 py-3">{r.businesses ? `${r.businesses.name} (${r.businesses.city})` : '—'}</td>
              <td className="px-4 py-3">
                <span className={statusColor[r.status]}>{statusLabel[r.status]}</span>
              </td>
              <td className="px-4 py-3">{r.estimated_arrival_minutes !== null ? `${r.estimated_arrival_minutes} min` : '—'}</td>
              <td className="px-4 py-3">{new Date(r.created_at).toLocaleString('es-EC')}</td>
              <td className="px-4 py-3">{r.accepted_at ? new Date(r.accepted_at).toLocaleString('es-EC') : '—'}</td>
              <td className="px-4 py-3">{r.completed_at ? new Date(r.completed_at).toLocaleString('es-EC') : '—'}</td>
            </tr>
          ))}
          {requests.length === 0 && !listResult.error && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                No hay solicitudes de auxilio todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="mt-4 flex gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`?page=${p}`}
              className={`rounded-lg px-3 py-1 text-sm ${p === page ? 'bg-primary text-white' : 'bg-white text-gray-700'}`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
