'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

export function BeneficiaryExpiryEditor({ subscriptionId, expiresAt }: { subscriptionId: string; expiresAt: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(toDateInputValue(expiresAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!value) return;
    const formatted = new Date(value).toLocaleDateString('es-EC');
    if (!window.confirm(`¿Cambiar la fecha de corte de este negocio a ${formatted}?`)) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/promociones/beneficiarios/${subscriptionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresAt: value }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span>{expiresAt ? new Date(expiresAt).toLocaleDateString('es-EC') : '—'}</span>
        <button onClick={() => setEditing(true)} className="text-xs font-semibold text-primary hover:underline">
          Cambiar fecha
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {saving ? '...' : 'Guardar'}
      </button>
      <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:underline">
        Cancelar
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
