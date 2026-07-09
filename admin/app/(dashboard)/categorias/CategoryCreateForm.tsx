'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CategoryKind } from '../../../lib/types';

export function CategoryCreateForm({ kind }: { kind: CategoryKind }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Ingresa el nombre de la categoría.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), kind }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    setName('');
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold">Nueva categoría de {kind === 'product' ? 'producto' : 'servicio'}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Nombre
          <input
            type="text"
            placeholder="Cascos"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-48 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={handleCreate}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Creando…' : '+ Agregar'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
