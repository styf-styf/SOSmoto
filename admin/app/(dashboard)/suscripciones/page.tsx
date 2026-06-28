import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminPaymentRow, PaymentStatus, PlanName } from '../../../lib/types';
import { PaymentRefundButton } from './PaymentRefundButton';

const PAGE_SIZE = 25;

const planLabel: Record<PlanName, string> = {
  free: 'Free',
  standard: 'Estándar',
  pro: 'Pro',
};

const statusLabel: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  completed: 'Completado',
  failed: 'Fallido',
  refunded: 'Reembolsado',
};

const statusColor: Record<PaymentStatus, string> = {
  pending: 'text-yellow-600',
  completed: 'text-green-700',
  failed: 'text-red-600',
  refunded: 'text-gray-500',
};

export default async function SuscripcionesPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createAdminClient();

  const [businessesResult, revenueResult, paymentsResult] = await Promise.all([
    supabase.from('businesses').select('id, subscription_plans(name)'),
    supabase.from('payments').select('amount').eq('type', 'subscription').eq('status', 'completed'),
    supabase
      .from('payments')
      .select('id, business_id, amount, currency, type, gateway, status, created_at, businesses(name)', {
        count: 'exact',
      })
      .eq('type', 'subscription')
      .order('created_at', { ascending: false })
      .range(from, to),
  ]);

  const planCounts: Record<PlanName, number> = { free: 0, standard: 0, pro: 0 };
  for (const row of (businessesResult.data ?? []) as unknown as { subscription_plans: { name: PlanName } | null }[]) {
    const name = row.subscription_plans?.name;
    if (name) planCounts[name]++;
  }

  const totalRevenue = (revenueResult.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const payments = (paymentsResult.data ?? []) as unknown as AdminPaymentRow[];
  const totalPages = paymentsResult.count ? Math.ceil(paymentsResult.count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Suscripciones</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Ingresos por suscripciones</p>
          <p className="text-2xl font-bold text-primary">${totalRevenue.toFixed(2)}</p>
        </div>
        {(['free', 'standard', 'pro'] as PlanName[]).map((name) => (
          <div key={name} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">Plan {planLabel[name]}</p>
            <p className="text-2xl font-bold">{planCounts[name]}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Historial de pagos</h2>
      {paymentsResult.error && <p className="text-sm text-red-600">Error: {paymentsResult.error.message}</p>}

      <table className="w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-3">Negocio</th>
            <th className="px-4 py-3">Monto</th>
            <th className="px-4 py-3">Pasarela</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-b border-gray-100">
              <td className="px-4 py-3 font-medium">{payment.businesses?.name ?? '—'}</td>
              <td className="px-4 py-3">
                {payment.currency} ${Number(payment.amount).toFixed(2)}
              </td>
              <td className="px-4 py-3 capitalize">{payment.gateway}</td>
              <td className="px-4 py-3">
                <span className={statusColor[payment.status]}>{statusLabel[payment.status]}</span>
              </td>
              <td className="px-4 py-3">{new Date(payment.created_at).toLocaleString('es-EC')}</td>
              <td className="px-4 py-3">
                {payment.status !== 'refunded' && <PaymentRefundButton paymentId={payment.id} />}
              </td>
            </tr>
          ))}
          {payments.length === 0 && !paymentsResult.error && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                No hay pagos de suscripción todavía.
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
