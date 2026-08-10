import { createAdminClient } from '../../../lib/supabase/admin';
import type { AccountDeletionStatus, AdminAccountDeletionRequestRow } from '../../../lib/types';
import { Paginator } from '../../../components/Paginator';

const HISTORY_PAGE_SIZE = 20;

const REQUEST_SELECT =
  'id, user_id, reason, status, requested_at, scheduled_for, cancelled_at, completed_at, users(full_name, email, role)';

const statusLabel: Record<AccountDeletionStatus, string> = {
  pending: 'Pendiente',
  cancelled: 'Cancelada',
  completed: 'Completada',
};

const statusColor: Record<AccountDeletionStatus, string> = {
  pending: 'text-yellow-600',
  cancelled: 'text-gray-500',
  completed: 'text-red-600',
};

// Página de solo visibilidad -- la eliminación real (anonimizar + bloquear
// login) la hace sola la Edge Function process-account-deletions a los 30
// días, sin que el admin tenga que aprobar nada acá. Esto es para poder
// auditar/seguir el motivo por el que la gente se va.
export default async function EliminacionCuentasPage({
  searchParams,
}: {
  searchParams: { history_page?: string };
}) {
  const historyPage = Math.max(1, Number(searchParams.history_page) || 1);
  const supabase = createAdminClient();

  const [pendingResult, historyResult] = await Promise.all([
    supabase
      .from('account_deletion_requests')
      .select(REQUEST_SELECT)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true }),
    supabase
      .from('account_deletion_requests')
      .select(REQUEST_SELECT, { count: 'exact' })
      .neq('status', 'pending')
      .order('requested_at', { ascending: false })
      .range((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE - 1),
  ]);

  const pending = (pendingResult.data ?? []) as unknown as AdminAccountDeletionRequestRow[];
  const history = (historyResult.data ?? []) as unknown as AdminAccountDeletionRequestRow[];
  const historyTotalPages = historyResult.count ? Math.ceil(historyResult.count / HISTORY_PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">Eliminación de cuentas</h1>
      <p className="mb-6 text-sm text-gray-500">
        Solo informativo: cada solicitud se procesa sola a los 30 días (se anonimiza y se bloquea el login; pagos y
        reseñas se conservan). El usuario puede cancelarla desde la app en cualquier momento antes de esa fecha.
      </p>

      <h2 className="mb-3 text-lg font-semibold">Pendientes ({pending.length})</h2>
      {pendingResult.error && <p className="text-sm text-red-600">Error: {pendingResult.error.message}</p>}
      <table className="mb-10 w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-3">Usuario</th>
            <th className="px-4 py-3">Rol</th>
            <th className="px-4 py-3">Motivo</th>
            <th className="px-4 py-3">Solicitada</th>
            <th className="px-4 py-3">Se elimina el</th>
          </tr>
        </thead>
        <tbody>
          {pending.map((req) => (
            <tr key={req.id} className="border-b border-gray-100">
              <td className="px-4 py-3 font-medium">{req.users?.full_name ?? '—'}</td>
              <td className="px-4 py-3 text-gray-500">{req.users?.role === 'business' ? 'Negocio' : 'Cliente'}</td>
              <td className="px-4 py-3 text-gray-500">{req.reason ?? '—'}</td>
              <td className="px-4 py-3">{new Date(req.requested_at).toLocaleDateString('es-419')}</td>
              <td className="px-4 py-3">{new Date(req.scheduled_for).toLocaleDateString('es-419')}</td>
            </tr>
          ))}
          {pending.length === 0 && !pendingResult.error && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                No hay solicitudes pendientes.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 className="mb-3 text-lg font-semibold">
        Historial{historyResult.count != null ? ` (${historyResult.count})` : ''}
      </h2>
      {historyResult.error && <p className="text-sm text-red-600">Error: {historyResult.error.message}</p>}
      <table className="w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-3">Usuario</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Motivo</th>
            <th className="px-4 py-3">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {history.map((req) => (
            <tr key={req.id} className="border-b border-gray-100">
              <td className="px-4 py-3 font-medium">{req.users?.full_name ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={statusColor[req.status]}>{statusLabel[req.status]}</span>
              </td>
              <td className="px-4 py-3 text-gray-500">{req.reason ?? '—'}</td>
              <td className="px-4 py-3">
                {new Date(req.completed_at ?? req.cancelled_at ?? req.requested_at).toLocaleDateString('es-419')}
              </td>
            </tr>
          ))}
          {history.length === 0 && !historyResult.error && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                Todavía no hay solicitudes resueltas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <Paginator page={historyPage} totalPages={historyTotalPages} buildHref={(p) => `?history_page=${p}`} />
    </div>
  );
}
