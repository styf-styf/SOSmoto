import Link from 'next/link';
import { createAdminClient } from '../../../lib/supabase/admin';

interface PaymentRow {
  id: string;
  amount: number;
  type: string;
  created_at: string;
  businesses: { name: string } | null;
}

interface KycRow {
  id: string;
  created_at: string;
  businesses: { name: string; city: string } | null;
}

interface ReportCountRow {
  target_type: string;
}

interface DisputeRow {
  id: string;
  created_at: string;
  admin_notes: string | null;
  businesses: { name: string } | null;
}

interface EmailRow {
  id: string;
  from_address: string;
  subject: string;
  created_at: string;
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  post: 'publicaciones',
  review: 'reseñas',
  business: 'negocios',
  product: 'productos',
  service: 'servicios',
};

function supabaseUsageUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const ref = new URL(url).hostname.split('.')[0];
    return `https://supabase.com/dashboard/project/${ref}/settings/billing/usage`;
  } catch {
    return null;
  }
}

export default async function InicioPage() {
  const supabase = createAdminClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [failedPaymentsResult, stuckPaymentsResult, kycResult, reportsResult, disputesResult, emailsResult] =
    await Promise.all([
      supabase
        .from('payments')
        .select('id, amount, type, created_at, businesses(name)')
        .eq('status', 'failed')
        .gte('created_at', fortyEightHoursAgo)
        .order('created_at', { ascending: false }),
      supabase
        .from('payments')
        .select('id, amount, type, created_at, businesses(name)')
        .eq('status', 'pending')
        .lt('created_at', oneHourAgo)
        .order('created_at', { ascending: true }),
      supabase
        .from('business_verification_requests')
        .select('id, created_at, businesses(name, city)')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: true }),
      supabase.from('reports').select('target_type').eq('status', 'pending'),
      supabase
        .from('help_requests')
        .select('id, created_at, admin_notes, businesses(name)')
        .eq('dispute_status', 'flagged')
        .order('created_at', { ascending: true }),
      supabase
        .from('emails')
        .select('id, from_address, subject, created_at')
        .eq('type', 'received')
        .eq('read', false)
        .order('created_at', { ascending: true }),
    ]);

  const failedPayments = (failedPaymentsResult.data ?? []) as unknown as PaymentRow[];
  const stuckPayments = (stuckPaymentsResult.data ?? []) as unknown as PaymentRow[];
  const kycPending = (kycResult.data ?? []) as unknown as KycRow[];
  const reportsPending = (reportsResult.data ?? []) as unknown as ReportCountRow[];
  const disputesFlagged = (disputesResult.data ?? []) as unknown as DisputeRow[];
  const unreadEmails = (emailsResult.data ?? []) as unknown as EmailRow[];

  const reportsByType = reportsPending.reduce<Record<string, number>>((acc, r) => {
    acc[r.target_type] = (acc[r.target_type] ?? 0) + 1;
    return acc;
  }, {});
  const moderationTotal = reportsPending.length + disputesFlagged.length;

  const errors = [
    failedPaymentsResult.error,
    stuckPaymentsResult.error,
    kycResult.error,
    reportsResult.error,
    disputesResult.error,
    emailsResult.error,
  ].filter(Boolean);

  const usageUrl = supabaseUsageUrl();
  const totalAttention = failedPayments.length + stuckPayments.length + kycPending.length + moderationTotal + unreadEmails.length;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Inicio</h1>
      <p className="mb-6 text-sm text-gray-500">
        Estado operativo del día: pagos, verificaciones, moderación y correos que necesitan tu atención.
      </p>

      {errors.length > 0 && (
        <p className="mb-4 text-sm text-red-600">
          Error cargando algunos datos: {errors.map((e) => e?.message).join(' · ')}
        </p>
      )}

      <div
        className={`mb-6 rounded-xl p-4 text-sm font-semibold shadow-sm ${
          totalAttention === 0 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
        }`}
      >
        {totalAttention === 0 ? 'Todo tranquilo — nada pendiente ahora mismo.' : `${totalAttention} cosas requieren tu atención.`}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Pagos fallidos (48h)</p>
          <p className="text-2xl font-bold">{failedPayments.length}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Pagos atascados (+1h)</p>
          <p className="text-2xl font-bold">{stuckPayments.length}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">KYC pendiente</p>
          <p className="text-2xl font-bold">{kycPending.length}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Moderación pendiente</p>
          <p className="text-2xl font-bold">{moderationTotal}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Correos sin leer</p>
          <p className="text-2xl font-bold">{unreadEmails.length}</p>
        </div>
      </div>

      {(failedPayments.length > 0 || stuckPayments.length > 0) && (
        <Section title="Pagos" href="/suscripciones">
          {failedPayments.map((p) => (
            <Row key={p.id} left={`${p.businesses?.name ?? '—'} · ${p.type === 'subscription' ? 'suscripción' : 'publicidad'}`}>
              Falló · ${p.amount} · {new Date(p.created_at).toLocaleString('es-EC')}
            </Row>
          ))}
          {stuckPayments.map((p) => (
            <Row key={p.id} left={`${p.businesses?.name ?? '—'} · ${p.type === 'subscription' ? 'suscripción' : 'publicidad'}`}>
              Pendiente desde {new Date(p.created_at).toLocaleString('es-EC')} · ${p.amount}
            </Row>
          ))}
        </Section>
      )}

      {kycPending.length > 0 && (
        <Section title="Verificación (KYC)" href="/kyc">
          {kycPending.map((k) => (
            <Row key={k.id} left={`${k.businesses?.name ?? '—'} · ${k.businesses?.city ?? ''}`}>
              Solicitada el {new Date(k.created_at).toLocaleDateString('es-EC')}
            </Row>
          ))}
        </Section>
      )}

      {moderationTotal > 0 && (
        <Section title="Moderación" href="/moderacion">
          {Object.entries(reportsByType).map(([type, count]) => (
            <Row key={type} left={TARGET_TYPE_LABELS[type] ?? type}>
              {count} reporte{count === 1 ? '' : 's'} pendiente{count === 1 ? '' : 's'}
            </Row>
          ))}
          {disputesFlagged.map((d) => (
            <Row key={d.id} left={`Auxilio · ${d.businesses?.name ?? '—'}`}>
              Marcada el {new Date(d.created_at).toLocaleDateString('es-EC')}
            </Row>
          ))}
        </Section>
      )}

      {unreadEmails.length > 0 && (
        <Section title="Correos sin leer" href="/correos">
          {unreadEmails.slice(0, 8).map((e) => (
            <Row key={e.id} left={e.from_address}>
              {e.subject || '(sin asunto)'} · {new Date(e.created_at).toLocaleDateString('es-EC')}
            </Row>
          ))}
          {unreadEmails.length > 8 && <p className="px-4 py-2 text-xs text-gray-400">y {unreadEmails.length - 8} más...</p>}
        </Section>
      )}

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-1 text-sm font-semibold">Cuotas de Supabase</p>
        <p className="text-xs text-gray-500">
          No es algo que se pueda leer con una consulta -- revisa manualmente el uso de Edge Functions, Realtime y
          egress antes de que llegue tráfico real, sobre todo si el proyecto sigue en el plan Free.
        </p>
        {usageUrl && (
          <a href={usageUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
            Abrir dashboard de uso →
          </a>
        )}
      </div>
    </div>
  );
}

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        <Link href={href} className="text-xs font-semibold text-primary hover:underline">
          Ver todo →
        </Link>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function Row({ left, children }: { left: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <span className="font-medium">{left}</span>
      <span className="text-xs text-gray-500">{children}</span>
    </div>
  );
}
