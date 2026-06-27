'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function UserActions({
  userId,
  isSuspended,
  isAdmin,
}: {
  userId: string;
  isSuspended: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: 'suspend' | 'reactivate' | 'reset-password', confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setLoading(action);
    setError(null);
    const res = await fetch(`/api/usuarios/${userId}/${action}`, { method: 'POST' });
    setLoading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  if (isAdmin) {
    return <span className="text-xs text-gray-400">No editable</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        {isSuspended ? (
          <button
            onClick={() => call('reactivate')}
            disabled={loading !== null}
            className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading === 'reactivate' ? '...' : 'Reactivar'}
          </button>
        ) : (
          <button
            onClick={() => call('suspend', '¿Suspender esta cuenta? El usuario no podrá iniciar sesión hasta que se reactive.')}
            disabled={loading !== null}
            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading === 'suspend' ? '...' : 'Suspender'}
          </button>
        )}
        <button
          onClick={() => call('reset-password', '¿Enviar un correo de restablecimiento de contraseña a este usuario?')}
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
