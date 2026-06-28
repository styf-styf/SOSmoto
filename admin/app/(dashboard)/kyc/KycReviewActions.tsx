'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function KycReviewActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(decision: 'approved' | 'rejected') {
    let adminNotes: string | undefined;
    if (decision === 'rejected') {
      const reason = window.prompt('Motivo del rechazo (se le mostrará al negocio):');
      if (reason === null) return;
      adminNotes = reason;
    } else if (!window.confirm('¿Aprobar esta verificación? El negocio recibirá la insignia de "verificado".')) {
      return;
    }

    setLoading(decision);
    setError(null);
    const res = await fetch(`/api/kyc/${requestId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, adminNotes }),
    });
    setLoading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          onClick={() => review('approved')}
          disabled={loading !== null}
          className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading === 'approved' ? '...' : 'Aprobar'}
        </button>
        <button
          onClick={() => review('rejected')}
          disabled={loading !== null}
          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading === 'rejected' ? '...' : 'Rechazar'}
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
