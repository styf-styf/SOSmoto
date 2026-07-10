'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ReviewDeleteButton({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta reseña? No se puede deshacer.')) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/resenas/${reviewId}`, { method: 'DELETE' });
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
        onClick={handleDelete}
        disabled={loading}
        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {loading ? '...' : 'Eliminar'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
