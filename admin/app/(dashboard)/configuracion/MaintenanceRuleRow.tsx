'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminMaintenanceRuleRow } from '../../../lib/types';

export function MaintenanceRuleRow({ rule }: { rule: AdminMaintenanceRuleRow }) {
  const router = useRouter();
  const [intervalKm, setIntervalKm] = useState<number | null>(rule.interval_km);
  const [intervalMonths, setIntervalMonths] = useState<number | null>(rule.interval_months);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/reglas-mantenimiento/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval_km: intervalKm, interval_months: intervalMonths }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar la regla "${rule.service_name}"?`)) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/reglas-mantenimiento/${rule.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3 capitalize">{rule.moto_type}</td>
      <td className="px-4 py-3 font-medium">{rule.service_name}</td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={intervalKm ?? ''}
          placeholder="—"
          onChange={(e) => setIntervalKm(e.target.value === '' ? null : Number(e.target.value))}
          className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={intervalMonths ?? ''}
          placeholder="—"
          onChange={(e) => setIntervalMonths(e.target.value === '' ? null : Number(e.target.value))}
          className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? '...' : 'Guardar'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {deleting ? '...' : 'Eliminar'}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
