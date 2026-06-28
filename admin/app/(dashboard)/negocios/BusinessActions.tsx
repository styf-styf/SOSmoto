'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function BusinessActions({ businessId, isLimited }: { businessId: string; isLimited: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(action: 'limit' | 'unlimit', body?: Record<string, string>) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/negocios/${businessId}/${action}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setLoading(false);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      setError(errBody.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  function handleLimit() {
    const reason = window.prompt(
      'Motivo de la limitación (no puede crear anuncios nuevos, historias, publicaciones, editar catálogo, gestionar empleados ni usar el chat; sigue recibiendo solicitudes de auxilio):'
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setError('Debes ingresar un motivo.');
      return;
    }
    call('limit', { reason: reason.trim() });
  }

  return (
    <div className="flex flex-col gap-1">
      {isLimited ? (
        <button
          onClick={() => call('unlimit')}
          disabled={loading}
          className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading ? '...' : 'Quitar límite'}
        </button>
      ) : (
        <button
          onClick={handleLimit}
          disabled={loading}
          className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading ? '...' : 'Limitar'}
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
