'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { MotoType } from '../../../lib/types';

const motoTypes: MotoType[] = ['scooter', 'street', 'naked', 'enduro', 'sport', 'cruiser'];

export function MaintenanceRuleCreateForm() {
  const router = useRouter();
  const [motoType, setMotoType] = useState<MotoType>('street');
  const [serviceName, setServiceName] = useState('');
  const [intervalKm, setIntervalKm] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!serviceName.trim()) {
      setError('Ingresa el nombre del servicio.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/reglas-mantenimiento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moto_type: motoType,
        service_name: serviceName.trim(),
        interval_km: intervalKm === '' ? null : Number(intervalKm),
        interval_months: intervalMonths === '' ? null : Number(intervalMonths),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    setServiceName('');
    setIntervalKm('');
    setIntervalMonths('');
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold">Nueva regla</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Tipo de moto
          <select
            value={motoType}
            onChange={(e) => setMotoType(e.target.value as MotoType)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            {motoTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Servicio
          <input
            type="text"
            placeholder="Cambio de aceite"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            className="w-48 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Intervalo (km)
          <input
            type="number"
            placeholder="3000"
            value={intervalKm}
            onChange={(e) => setIntervalKm(e.target.value)}
            className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Intervalo (meses)
          <input
            type="number"
            placeholder="6"
            value={intervalMonths}
            onChange={(e) => setIntervalMonths(e.target.value)}
            className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
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
