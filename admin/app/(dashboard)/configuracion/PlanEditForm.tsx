'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminSubscriptionPlanRow } from '../../../lib/types';

const PLAN_LABELS: Record<string, string> = { free: 'Free', standard: 'Estándar', pro: 'Pro' };

function displayVal(n: number | null) {
  return n === null ? 'Ilimitado' : String(n);
}

// Una fila = etiqueta a la izquierda, valor (o input, en modo edición) a la
// derecha -- mismo layout en los dos modos, solo cambia si el valor es texto
// o un campo editable. El grid padre las acomoda de a 2 columnas.
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </div>
  );
}

function NullableNumberInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      placeholder="Ilimitado"
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm text-gray-900"
    />
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

      <div className="grid grid-cols-1 gap-2 text-sm">
        <FieldRow label="Precio mensual (USD)">
          {editing ? (
            <input
              type="number"
              step="0.01"
              value={priceMonthly}
              onChange={(e) => setPriceMonthly(Number(e.target.value))}
              className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm text-gray-900"
            />
          ) : (
            <span className="font-medium">${Number(priceMonthly).toFixed(2)}</span>
          )}
        </FieldRow>

        <FieldRow label="Máx. productos">
          {editing ? (
            <NullableNumberInput value={maxProducts} onChange={setMaxProducts} />
          ) : (
            <span className="font-medium">{displayVal(maxProducts)}</span>
          )}
        </FieldRow>

        <FieldRow label="Máx. servicios">
          {editing ? (
            <NullableNumberInput value={maxServices} onChange={setMaxServices} />
          ) : (
            <span className="font-medium">{displayVal(maxServices)}</span>
          )}
        </FieldRow>

        <FieldRow label="Máx. fotos (producto/servicio/publicación)">
          {editing ? (
            <input
              type="number"
              min={1}
              value={maxPhotosPerItem}
              onChange={(e) => setMaxPhotosPerItem(Number(e.target.value))}
              className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm text-gray-900"
            />
          ) : (
            <span className="font-medium">{maxPhotosPerItem}</span>
          )}
        </FieldRow>

        <FieldRow label="Máx. empleados">
          {editing ? (
            <NullableNumberInput value={maxEmployees} onChange={setMaxEmployees} />
          ) : (
            <span className="font-medium">{displayVal(maxEmployees)}</span>
          )}
        </FieldRow>

        <FieldRow label="Máx. historias activas">
          {editing ? (
            <NullableNumberInput value={maxActiveStories} onChange={setMaxActiveStories} />
          ) : (
            <span className="font-medium">{displayVal(maxActiveStories)}</span>
          )}
        </FieldRow>
      </div>

      {saved && !editing && <p className="mt-2 text-xs text-green-700">Guardado.</p>}

      {editing && (
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
      )}
    </div>
  );
}
