import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminVerificationRequestRow, KycStatus } from '../../../lib/types';
import { KycReviewActions } from './KycReviewActions';

const KYC_BUCKET = 'kyc-documents';
const SIGNED_URL_TTL_SECONDS = 600;

const REQUEST_SELECT =
  'id, business_id, id_document_path, ruc_document_path, storefront_photo_path, notes, status, admin_notes, created_at, businesses(name, city, is_verified)';

const statusLabel: Record<KycStatus, string> = {
  pending_review: 'En revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const statusColor: Record<KycStatus, string> = {
  pending_review: 'text-yellow-600',
  approved: 'text-green-700',
  rejected: 'text-red-600',
};

async function buildSignedUrlMap(
  supabase: ReturnType<typeof createAdminClient>,
  requests: AdminVerificationRequestRow[]
): Promise<Map<string, string>> {
  const paths = requests.flatMap((r) =>
    [r.id_document_path, r.ruc_document_path, r.storefront_photo_path].filter((p): p is string => !!p)
  );
  const map = new Map<string, string>();
  if (paths.length === 0) return map;

  const { data } = await supabase.storage.from(KYC_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  (data ?? []).forEach((item, i) => {
    if (item.signedUrl) map.set(paths[i], item.signedUrl);
  });
  return map;
}

function DocLink({ label, url }: { label: string; url: string | undefined }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt={label} className="h-32 w-full rounded-lg object-cover" />
      <span className="text-xs text-gray-500">{label}</span>
    </a>
  );
}

export default async function KycPage() {
  const supabase = createAdminClient();

  const [pendingResult, historyResult] = await Promise.all([
    supabase.from('business_verification_requests').select(REQUEST_SELECT).eq('status', 'pending_review').order('created_at', { ascending: true }),
    supabase
      .from('business_verification_requests')
      .select(REQUEST_SELECT)
      .neq('status', 'pending_review')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const pending = (pendingResult.data ?? []) as unknown as AdminVerificationRequestRow[];
  const history = (historyResult.data ?? []) as unknown as AdminVerificationRequestRow[];
  const signedUrls = await buildSignedUrlMap(supabase, [...pending, ...history]);

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">Verificación (KYC)</h1>
      <p className="mb-6 text-sm text-gray-500">
        Revisa cédula/RUC y foto del local antes de otorgar la insignia de "verificado". Los documentos son privados:
        los enlaces de abajo expiran en 10 minutos.
      </p>

      <h2 className="mb-3 text-lg font-semibold">Pendientes ({pending.length})</h2>
      {pendingResult.error && <p className="text-sm text-red-600">Error: {pendingResult.error.message}</p>}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {pending.map((req) => (
          <div key={req.id} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-1 text-sm font-semibold">{req.businesses?.name ?? 'Negocio'}</p>
            <p className="mb-3 text-xs text-gray-500">{req.businesses?.city}</p>
            <div className="grid grid-cols-2 gap-2">
              <DocLink label="Identificación" url={signedUrls.get(req.id_document_path)} />
              {req.ruc_document_path && <DocLink label="RUC" url={signedUrls.get(req.ruc_document_path)} />}
              <DocLink label="Local" url={signedUrls.get(req.storefront_photo_path)} />
            </div>
            {req.notes && <p className="mt-2 text-xs text-gray-600">"{req.notes}"</p>}
            <p className="mt-2 text-xs text-gray-400">{new Date(req.created_at).toLocaleString('es-EC')}</p>
            <KycReviewActions requestId={req.id} />
          </div>
        ))}
        {pending.length === 0 && !pendingResult.error && (
          <p className="text-sm text-gray-500">No hay solicitudes pendientes.</p>
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Historial reciente</h2>
      {historyResult.error && <p className="text-sm text-red-600">Error: {historyResult.error.message}</p>}
      <table className="w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-3">Negocio</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Notas del admin</th>
            <th className="px-4 py-3">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {history.map((req) => (
            <tr key={req.id} className="border-b border-gray-100">
              <td className="px-4 py-3 font-medium">{req.businesses?.name ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={statusColor[req.status]}>{statusLabel[req.status]}</span>
              </td>
              <td className="px-4 py-3 text-gray-500">{req.admin_notes ?? '—'}</td>
              <td className="px-4 py-3">{new Date(req.created_at).toLocaleString('es-EC')}</td>
            </tr>
          ))}
          {history.length === 0 && !historyResult.error && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                Todavía no hay solicitudes revisadas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
