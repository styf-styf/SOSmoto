'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdReviewActions({ adId }: { adId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<'active' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(decision: 'active' | 'rejected') {
    let reason: string | undefined;
    if (decision === 'rejected') {
      const input = window.prompt('Razón del rechazo (el negocio la verá para poder corregir y reenviar):');
      if (input === null) return;
      reason = input;
    }
    setLoading(decision);
    setError(null);
    const res = await fetch(`/api/campanas/${adId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason }),
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
          onClick={() => review('active')}
          disabled={loading !== null}
          className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading === 'active' ? '...' : 'Aprobar'}
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
