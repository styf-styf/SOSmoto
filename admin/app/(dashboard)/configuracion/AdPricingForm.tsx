'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminAdPricingRow } from '../../../lib/types';

export function AdPricingForm({ pricing }: { pricing: AdminAdPricingRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [city, setCity] = useState(pricing.price_per_day_city);
  const [national, setNational] = useState(pricing.price_per_day_national);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleCancel() {
    setCity(pricing.price_per_day_city);
    setNational(pricing.price_per_day_national);
    setError(null);
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch('/api/publicidad-precios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_per_day_city: city, price_per_day_national: national }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    setSaved(true);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Precios de publicidad</p>
        {!editing && (
          <button
            onClick={() => { setSaved(false); setEditing(true); }}
            className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Editar
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-gray-400">Por día (ciudad)</dt>
            <dd className="font-medium">${Number(city).toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Por día (nacional)</dt>
            <dd className="font-medium">${Number(national).toFixed(2)}</dd>
          </div>
          {saved && <div className="w-full text-xs text-green-700">Guardado.</div>}
        </dl>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              Precio por día (ciudad)
              <input
                type="number"
                step="0.01"
                value={city}
                onChange={(e) => setCity(Number(e.target.value))}
                className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              Precio por día (nacional)
              <input
                type="number"
                step="0.01"
                value={national}
                onChange={(e) => setNational(Number(e.target.value))}
                className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-600 disabled:opacity-60"
            >
              Cancelar
            </button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </>
      )}
    </div>
  );
}
