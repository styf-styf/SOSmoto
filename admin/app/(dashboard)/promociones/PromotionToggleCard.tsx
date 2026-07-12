'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const PLAN_LABELS: Record<string, string> = { free: 'Free', standard: 'Estándar', pro: 'Pro' };

export function PromotionToggleCard({
  planId,
  planName,
  isActive,
  otherPlanIsActive,
  durationDays,
  remainingDays,
}: {
  planId: string;
  planName: string;
  isActive: boolean;
  otherPlanIsActive: boolean;
  durationDays: number | null;
  remainingDays: number | null;
}) {
  const router = useRouter();
  const planLabel = PLAN_LABELS[planName] ?? planName;
  const hasDaysSet = remainingDays !== null && remainingDays > 0;
  const [days, setDays] = useState(remainingDays ?? durationDays ?? 90);
  const [loading, setLoading] = useState<'toggle' | 'days' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const message = isActive
      ? `¿Pausar la promoción del plan ${planLabel}? Los negocios nuevos dejarán de ver el botón de reclamo gratis. Quienes ya la reclamaron no se ven afectados.`
      : `¿Activar la promoción del plan ${planLabel}? Todo negocio nuevo que se registre a partir de ahora podrá reclamar este plan gratis por ${remainingDays} días.`;
    if (!window.confirm(message)) return;

    setLoading('toggle');
    setError(null);
    const res = isActive
      ? await fetch('/api/promociones/desactivar', { method: 'POST' })
      : await fetch('/api/promociones/activar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId }),
        });
    setLoading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  async function handleSaveDays() {
    setLoading('days');
    setError(null);
    const res = await fetch('/api/promociones/dias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, days }),
    });
    setLoading(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  const toggleDisabled = loading !== null || (otherPlanIsActive && !isActive) || (!isActive && !hasDaysSet);

  return (
    <div className={`rounded-xl bg-white p-4 shadow-sm ${isActive ? 'ring-2 ring-primary' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Plan {planLabel}</p>
        <button
          onClick={handleToggle}
          disabled={toggleDisabled}
          className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-40 ${
            isActive ? 'bg-primary' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              isActive ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {isActive && (
        <>
          <p className="text-2xl font-bold text-primary">{remainingDays} días</p>
          <p className="mb-2 text-xs text-gray-500">restantes de la campaña (regalo de {durationDays} días por negocio)</p>
        </>
      )}

      <label className="mb-1 block text-xs text-gray-500">
        {hasDaysSet ? (isActive ? 'Días (pausa para editar)' : 'Días restantes de la campaña') : 'Días de duración de la oferta'}
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          disabled={isActive}
          className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          onClick={handleSaveDays}
          disabled={isActive || loading !== null}
          className="whitespace-nowrap rounded-lg bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-60"
        >
          {loading === 'days' ? '...' : 'Guardar días'}
        </button>
      </div>

      {otherPlanIsActive && !isActive && (
        <p className="mt-2 text-xs text-gray-500">Desactiva la otra promoción activa para poder activar esta.</p>
      )}
      {!isActive && !hasDaysSet && (
        <p className="mt-2 text-xs text-gray-500">Guarda los días de duración antes de poder activar la promoción.</p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
