'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminAdPricingRow } from '../../../lib/types';

export function AdPricingForm({ pricing }: { pricing: AdminAdPricingRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [city, setCity] = useState(pricing.price_per_day_city);
  const [national, setNational] = useState(pricing.price_per_day_national);
  const [referenceKm, setReferenceKm] = useState(pricing.radius_reference_km);
  const [capKm, setCapKm] = useState(pricing.radius_cap_km);
  const [editingRadius, setEditingRadius] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleCancel() {
    setCity(pricing.price_per_day_city);
    setNational(pricing.price_per_day_national);
    setReferenceKm(pricing.radius_reference_km);
    setCapKm(pricing.radius_cap_km);
    setError(null);
    setEditing(false);
    setEditingRadius(false);
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    if (!Number.isFinite(city) || city < 0 || !Number.isFinite(national) || national < 0) {
      setError('Los precios deben ser números válidos mayores o iguales a 0.');
      return;
    }
    if (city > national) {
      setError('El precio de Ciudad no puede ser mayor al de País (ni el de País menor al de Ciudad).');
      return;
    }
    if (!Number.isFinite(referenceKm) || referenceKm <= 0 || !Number.isFinite(capKm) || capKm <= 0) {
      setError('El radio de referencia y el radio tope deben ser números mayores a 0.');
      return;
    }
    if (referenceKm >= capKm) {
      setError('El "radio de referencia" debe ser menor al "radio tope".');
      return;
    }

    setSaving(true);
    const res = await fetch('/api/publicidad-precios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_per_day_city: city,
        price_per_day_national: national,
        radius_reference_km: referenceKm,
        radius_cap_km: capKm,
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
    setEditingRadius(false);
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
            <dt className="text-xs text-gray-400">Radio</dt>
            <dd className="font-medium">
              {referenceKm} km = ciudad · {capKm} km = país
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Por día (nacional)</dt>
            <dd className="font-medium">${Number(national).toFixed(2)}</dd>
          </div>
          {saved && <div className="w-full text-xs text-green-700">Guardado.</div>}
        </dl>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
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

            <div className="flex flex-col gap-1 text-xs text-gray-500">
              Radio
              <button
                type="button"
                onClick={() => setEditingRadius((v) => !v)}
                className="rounded-lg border border-gray-300 px-2 py-1 text-left text-sm text-gray-900 hover:bg-gray-50"
              >
                {referenceKm} km = ciudad · {capKm} km = país
              </button>
            </div>

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

          {editingRadius && (
            <div className="mt-3 rounded-lg bg-orange-50 p-3 text-xs leading-relaxed text-orange-900">
              <p className="mb-2">
                El precio del alcance &quot;Radio&quot; no se fija a mano -- se interpola entre el precio de Ciudad y
                el de País usando estos dos anclajes en <b>kilómetros</b> (no en dólares): a{' '}
                <b>radio de referencia</b> km cuesta lo mismo que Ciudad; a <b>radio tope</b> km (o más) cuesta lo
                mismo que País y ya no sigue subiendo. Fórmula:{' '}
                <code className="rounded bg-orange-100 px-1">precio(km) = base + tarifa_por_km × km</code>, donde{' '}
                <code className="rounded bg-orange-100 px-1">base</code> y{' '}
                <code className="rounded bg-orange-100 px-1">tarifa_por_km</code> se recalculan solos a partir de los
                precios de Ciudad/País de arriba -- por eso no hace falta tocar esto cuando solo cambian los precios,
                solo si quieres mover en qué radio exacto cruza cada tarifa.
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="flex flex-col gap-1 text-gray-600">
                  Radio de referencia (km)
                  <input
                    type="number"
                    step="1"
                    value={referenceKm}
                    onChange={(e) => setReferenceKm(Number(e.target.value))}
                    className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-gray-600">
                  Radio tope (km)
                  <input
                    type="number"
                    step="1"
                    value={capKm}
                    onChange={(e) => setCapKm(Number(e.target.value))}
                    className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
                  />
                </label>
              </div>
            </div>
          )}

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
