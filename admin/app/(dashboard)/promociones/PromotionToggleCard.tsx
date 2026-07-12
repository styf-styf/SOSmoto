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
  const hasCampaign = remainingDays !== null && remainingDays > 0;
  const [newDurationDays, setNewDurationDays] = useState(durationDays ?? 90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setLoading(true);
    setError(null);
    const res = isActive
      ? await fetch('/api/promociones/desactivar', { method: 'POST' })
      : await fetch('/api/promociones/activar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, durationDays: newDurationDays }),
        });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  return (
    <div className={`rounded-xl bg-white p-4 shadow-sm ${isActive ? 'ring-2 ring-primary' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Plan {PLAN_LABELS[planName] ?? planName}</p>
        <button
          onClick={handleToggle}
          disabled={loading}
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

      {hasCampaign ? (
        <>
          <p className="text-2xl font-bold text-primary">{remainingDays} días</p>
          <p className="text-xs text-gray-500">
            {isActive ? 'restantes de la campaña (regalo: ' : 'pausada -- quedaban (regalo: '}
            {durationDays} días por negocio)
          </p>
        </>
      ) : (
        <>
          <label className="mb-1 block text-xs text-gray-500">Días de duración de la oferta</label>
          <input
            type="number"
            min={1}
            value={newDurationDays}
            onChange={(e) => setNewDurationDays(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
          />
        </>
      )}

      {otherPlanIsActive && !isActive && (
        <p className="mt-2 text-xs text-gray-500">Activar esta pausará automáticamente la otra promoción activa.</p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
