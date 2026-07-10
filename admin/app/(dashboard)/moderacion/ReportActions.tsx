'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<'reviewed' | 'dismissed' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: 'reviewed' | 'dismissed') {
    setLoading(status);
    setError(null);
    const res = await fetch(`/api/reportes/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
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
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          onClick={() => setStatus('reviewed')}
          disabled={loading !== null}
          className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading === 'reviewed' ? '...' : 'Revisado'}
        </button>
        <button
          onClick={() => setStatus('dismissed')}
          disabled={loading !== null}
          className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 disabled:opacity-60"
        >
          {loading === 'dismissed' ? '...' : 'Descartar'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
