'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function UserActions({
  userId,
  isLimited,
  isAdmin,
}: {
  userId: string;
  isLimited: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: 'limit' | 'unlimit' | 'reset-password', body?: Record<string, string>) {
    setLoading(action);
    setError(null);
    const res = await fetch(`/api/usuarios/${userId}/${action}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setLoading(null);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      setError(errBody.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  function handleLimit() {
    const reason = window.prompt(
      'Motivo de la limitación (se le mostrará al usuario; no puede crear publicaciones, subir historias ni buscar talleres, pero sigue pudiendo pedir auxilio):'
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setError('Debes ingresar un motivo.');
      return;
    }
    call('limit', { reason: reason.trim() });
  }

  if (isAdmin) {
    return <span className="text-xs text-gray-400">No editable</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        {isLimited ? (
          <button
            onClick={() => {
              if (window.confirm('¿Quitar el límite a este usuario? Recuperará acceso completo de inmediato.')) call('unlimit');
            }}
            disabled={loading !== null}
            className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading === 'unlimit' ? '...' : 'Quitar límite'}
          </button>
        ) : (
          <button
            onClick={handleLimit}
            disabled={loading !== null}
            className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading === 'limit' ? '...' : 'Limitar'}
          </button>
        )}
        <button
          onClick={() => {
            if (window.confirm('¿Enviar un correo de restablecimiento de contraseña a este usuario?')) call('reset-password');
          }}
          disabled={loading !== null}
          className="rounded-lg bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-60"
        >
          {loading === 'reset-password' ? '...' : 'Reset password'}
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
