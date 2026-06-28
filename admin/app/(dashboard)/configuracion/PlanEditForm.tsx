'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminSubscriptionPlanRow } from '../../../lib/types';

function NumberField({
  label,
  value,
  onChange,
  unlimited,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unlimited?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-500">
      {label}
      <input
        type="number"
        value={value ?? ''}
        placeholder={unlimited ? 'Ilimitado' : ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
      />
    </label>
  );
}

export function PlanEditForm({ plan }: { plan: AdminSubscriptionPlanRow }) {
  const router = useRouter();
  const [priceMonthly, setPriceMonthly] = useState(plan.price_monthly);
  const [maxProducts, setMaxProducts] = useState<number | null>(plan.max_products);
  const [maxServices, setMaxServices] = useState<number | null>(plan.max_services);
  const [maxEmployees, setMaxEmployees] = useState<number | null>(plan.max_employees);
  const [maxActiveStories, setMaxActiveStories] = useState<number | null>(plan.max_active_stories);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/planes/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_monthly: priceMonthly,
        max_products: maxProducts,
        max_services: maxServices,
        max_employees: maxEmployees,
        max_active_stories: maxActiveStories,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-bold capitalize">{plan.name}</p>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Precio mensual (USD)
          <input
            type="number"
            step="0.01"
            value={priceMonthly}
            onChange={(e) => setPriceMonthly(Number(e.target.value))}
            className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
          />
        </label>
        <NumberField label="Máx. productos" value={maxProducts} onChange={setMaxProducts} unlimited />
        <NumberField label="Máx. servicios" value={maxServices} onChange={setMaxServices} unlimited />
        <NumberField label="Máx. empleados" value={maxEmployees} onChange={setMaxEmployees} unlimited />
        <NumberField label="Máx. historias activas" value={maxActiveStories} onChange={setMaxActiveStories} unlimited />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {saved && <span className="text-xs text-green-700">Guardado.</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
