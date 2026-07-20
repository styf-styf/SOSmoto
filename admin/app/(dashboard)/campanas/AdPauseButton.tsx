'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdPauseButton({ adId }: { adId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePause() {
    if (!window.confirm('¿Pausar esta campaña? Dejará de mostrarse de inmediato.')) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/campanas/${adId}/pause`, { method: 'POST' });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2">
      <button
        onClick={handlePause}
        disabled={loading}
        className="rounded-lg bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-60"
      >
        {loading ? '...' : 'Pausar'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
