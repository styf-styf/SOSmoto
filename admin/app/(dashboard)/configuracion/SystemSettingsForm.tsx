'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminSystemSettingsRow } from '../../../lib/types';

export function SystemSettingsForm({ settings }: { settings: AdminSystemSettingsRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [radius, setRadius] = useState(settings.default_aid_radius_km);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleCancel() {
    setRadius(settings.default_aid_radius_km);
    setError(null);
    setEditing(false);
  }

  async function handleSave() {
    if (radius < 1) {
      setError('El radio debe ser al menos 1 km.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch('/api/sistema', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_aid_radius_km: radius }),
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
        <p className="text-sm font-semibold text-gray-700">Auxilio en carretera</p>
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
            <dt className="text-xs text-gray-400">Radio de cobertura por defecto (talleres nuevos)</dt>
            <dd className="font-medium">{radius} km</dd>
          </div>
          {saved && <div className="w-full text-xs text-green-700">Guardado.</div>}
        </dl>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Radio de cobertura por defecto (km)
            <input
              type="number"
              min={1}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
            />
          </label>
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
