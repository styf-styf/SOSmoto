'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function PromotionScopeToggle({ appliesToAll }: { appliesToAll: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const next = !appliesToAll;
    const message = next
      ? '¿Cambiar el alcance a "Todos"? La promoción activa (si hay una) podrá ser reclamada por cualquier negocio ya registrado, no solo los nuevos.'
      : '¿Cambiar el alcance a "Nuevos negocios"? Solo los negocios que se registren de aquí en adelante podrán reclamar la promoción activa.';
    if (!window.confirm(message)) return;

    setLoading(true);
    setError(null);
    const res = await fetch('/api/promociones/alcance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appliesToAll: next }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="mb-6 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold">Alcance de la promoción</p>
        <p className="text-xs text-gray-500">
          {appliesToAll
            ? 'Todos los negocios ya registrados pueden reclamarla.'
            : 'Solo los negocios nuevos, registrados después de activarse.'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold ${!appliesToAll ? 'text-primary' : 'text-gray-400'}`}>Nuevos negocios</span>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-40 ${
            appliesToAll ? 'bg-primary' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              appliesToAll ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <span className={`text-xs font-semibold ${appliesToAll ? 'text-primary' : 'text-gray-400'}`}>Todos</span>
      </div>
      {error && <p className="ml-4 text-xs text-red-600">{error}</p>}
    </div>
  );
}
