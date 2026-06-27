'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function BusinessActions({ businessId, isSuspended }: { businessId: string; isSuspended: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(action: 'suspend' | 'reactivate', confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/negocios/${businessId}/${action}`, { method: 'POST' });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      {isSuspended ? (
        <button
          onClick={() => call('reactivate')}
          disabled={loading}
          className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading ? '...' : 'Reactivar'}
        </button>
      ) : (
        <button
          onClick={() =>
            call('suspend', '¿Suspender este negocio? Dejará de aparecer en la búsqueda pública hasta que se reactive.')
          }
          disabled={loading}
          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading ? '...' : 'Suspender'}
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
