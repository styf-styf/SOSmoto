'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminSubscriptionPlanRow } from '../../../lib/types';

const PLAN_LABELS: Record<string, string> = { free: 'Free', standard: 'Estándar', pro: 'Pro' };

function displayVal(n: number | null) {
  return n === null ? 'Ilimitado' : String(n);
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-500">
      {label}
      <input
        type="number"
        value={value ?? ''}
        placeholder="Ilimitado"
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
      />
    </label>
  );
}

export function PlanEditForm({ plan }: { plan: AdminSubscriptionPlanRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [priceMonthly, setPriceMonthly] = useState(plan.price_monthly);
  const [maxProducts, setMaxProducts] = useState<number | null>(plan.max_products);
  const [maxServices, setMaxServices] = useState<number | null>(plan.max_services);
  const [maxPhotosPerItem, setMaxPhotosPerItem] = useState(plan.max_photos_per_item);
  const [maxEmployees, setMaxEmployees] = useState<number | null>(plan.max_employees);
  const [maxActiveStories, setMaxActiveStories] = useState<number | null>(plan.max_active_stories);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleCancel() {
    setPriceMonthly(plan.price_monthly);
    setMaxProducts(plan.max_products);
    setMaxServices(plan.max_services);
    setMaxPhotosPerItem(plan.max_photos_per_item);
    setMaxEmployees(plan.max_employees);
    setMaxActiveStories(plan.max_active_stories);
    setError(null);
    setEditing(false);
  }

  async function handleSave() {
    if (maxPhotosPerItem < 1) {
      setError('Máx. fotos debe ser al menos 1.');
      return;
    }
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
        max_photos_per_item: maxPhotosPerItem,
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
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">{PLAN_LABELS[plan.name] ?? plan.name}</p>
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
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-gray-400">Precio mensual</dt>
            <dd className="font-medium">${Number(priceMonthly).toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Máx. productos</dt>
            <dd className="font-medium">{displayVal(maxProducts)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Máx. servicios</dt>
            <dd className="font-medium">{displayVal(maxServices)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Máx. fotos (producto/servicio/publicación)</dt>
            <dd className="font-medium">{maxPhotosPerItem}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Máx. empleados</dt>
            <dd className="font-medium">{displayVal(maxEmployees)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Máx. historias activas</dt>
            <dd className="font-medium">{displayVal(maxActiveStories)}</dd>
          </div>
          {saved && <div className="col-span-full text-xs text-green-700">Guardado.</div>}
        </dl>
      ) : (
        <>
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
            <NumberField label="Máx. productos" value={maxProducts} onChange={setMaxProducts} />
            <NumberField label="Máx. servicios" value={maxServices} onChange={setMaxServices} />
            <label className="flex flex-col gap-1 text-xs text-gray-500">
              Máx. fotos (producto/servicio/publicación)
              <input
                type="number"
                min={1}
                value={maxPhotosPerItem}
                onChange={(e) => setMaxPhotosPerItem(Number(e.target.value))}
                className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
              />
            </label>
            <NumberField label="Máx. empleados" value={maxEmployees} onChange={setMaxEmployees} />
            <NumberField label="Máx. historias activas" value={maxActiveStories} onChange={setMaxActiveStories} />
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
