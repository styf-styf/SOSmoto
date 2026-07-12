'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface BusinessResult {
  id: string;
  name: string;
  city: string;
}

const PLAN_LABELS: Record<string, string> = { free: 'Free', standard: 'Estándar', pro: 'Pro' };

export function AssignPlanForm({ plans }: { plans: { id: string; name: string }[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [selected, setSelected] = useState<BusinessResult | null>(null);
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selected || query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/promociones/negocios?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) return;
      const body = await res.json();
      setResults(body.businesses ?? []);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  function handleSelect(business: BusinessResult) {
    setSelected(business);
    setQuery(business.name);
    setResults([]);
  }

  function handleClearSelection() {
    setSelected(null);
    setQuery('');
  }

  async function handleAssign() {
    if (!selected || !planId || !expiresAt) return;
    const planLabel = PLAN_LABELS[plans.find((p) => p.id === planId)?.name ?? ''] ?? 'seleccionado';
    const formatted = new Date(expiresAt).toLocaleDateString('es-EC');
    if (
      !window.confirm(
        `¿Asignar el plan ${planLabel} a "${selected.name}" hasta el ${formatted}? Esto reemplaza su plan actual sin pasar por pago ni por las restricciones normales de la promoción.`
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    const res = await fetch('/api/promociones/asignar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: selected.id, planId, expiresAt }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    setSelected(null);
    setQuery('');
    setExpiresAt('');
    router.refresh();
  }

  return (
    <div className="mb-8 rounded-xl bg-white p-4 shadow-sm">
      <p className="mb-1 text-sm font-semibold">Asignar plan manualmente</p>
      <p className="mb-3 text-xs text-gray-500">
        Para casos especiales (un promotor ya lo ofreció en persona, o el negocio ya había reclamado una promoción
        antes). No pasa por Payphone ni valida las reglas normales de la promoción.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative">
          <label className="mb-1 block text-xs text-gray-500">Negocio</label>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="Buscar por nombre..."
            className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
          />
          {selected && (
            <button onClick={handleClearSelection} className="mt-1 text-xs text-primary hover:underline">
              Cambiar negocio
            </button>
          )}
          {!selected && results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
              {results.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => handleSelect(b)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {b.name} <span className="text-xs text-gray-400">· {b.city}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Plan</label>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {PLAN_LABELS[plan.name] ?? plan.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">Fecha de corte</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
          />
        </div>
      </div>

      <button
        onClick={handleAssign}
        disabled={!selected || !planId || !expiresAt || saving}
        className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {saving ? 'Asignando...' : 'Asignar plan'}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
